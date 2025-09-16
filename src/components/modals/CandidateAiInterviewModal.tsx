// src/components/modals/CandidateAiInterviewModal.tsx (DEFINITIVE VERSION)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { InterviewWebSocketManager } from '@/utils/InterviewWebSocketManager';
import { AudioRecorder } from '@/utils/AudioRecorder';
import { Video, VideoOff, Mic, MicOff, Bot, Loader2, Play, PhoneOff } from 'lucide-react';
import { AudioPlayer } from '@/utils/AudioPlayer';
import { startDatabaseInterview, finalizeInterview, InterviewApiError, prepareInterviewContext, startInterview } from '@/services/interviewApi';
import { supabase } from "@/integrations/supabase/client";

interface CandidateAiInterviewModalProps {
  interviewId: string;
  jobTitle: string;
  companyName: string;
  onInterviewComplete: () => void;
  initialShowResults?: boolean;
}

// We will store the full event log to build the transcript at the end
interface InterviewMessage {
  type: string;
  [key: string]: any; // Store the full event
}

const CandidateAiInterviewModal = ({ interviewId, jobTitle, companyName, onInterviewComplete, initialShowResults = false }: CandidateAiInterviewModalProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [interviewResults, setInterviewResults] = useState<any>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsManagerRef = useRef<InterviewWebSocketManager | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const hasEndedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  // This handles messages received from our backend via WebSocket
  const handleMessage = useCallback((event: any) => {
    const eventWithTimestamp = { ...event, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, eventWithTimestamp]);

    console.log('📨 Interview message received:', event.type, event);

    if (event.type === 'input_audio_buffer.speech_started') {
      // Call our new function to immediately stop the AI's voice.
      audioPlayerRef.current?.stopAndClearQueue();
      setIsSpeaking(false);
      console.log('🎤 User started speaking - AI interrupted');
    }

    if (event.type === 'response.audio.delta' && event.delta) {
      audioPlayerRef.current?.playChunk(event.delta);
      setIsSpeaking(true);
    } else if (event.type === 'response.done') {
      setIsSpeaking(false);
      console.log('🤖 AI finished speaking');
    } else if (event.type === 'error') {
      // Handle backend error events
      console.error('🚫 Backend error:', event.code, event.message);
      toast({
        title: "Interview Error",
        description: event.message || `Error: ${event.code}`,
        variant: "destructive"
      });
    } else if (event.type === 'pong') {
      // Heartbeat response - ignore
      return;
    } else if (event.type === 'interview_ended_by_ai') {
      // Handle AI-initiated interview end
      console.log('🤖 AI has ended the interview:', event.reason);
      toast({
        title: "Interview Completed",
        description: event.reason || "The interviewer has concluded the session.",
        duration: 5000
      });
      // Automatically end the interview
      setTimeout(() => {
        endInterview(true);
      }, 2000); // Give user time to see the message
      return;
    }
    
    // Additional barge-in: if we receive ANY audio chunk while AI is speaking, stop AI
    if (event.type === 'audio' && isSpeaking) {
      audioPlayerRef.current?.stopAndClearQueue();
      setIsSpeaking(false);
      console.log('🎤 User audio detected - stopping AI speech');
    }
  }, [isSpeaking]);

  const handleDisconnect = useCallback(async (event: CloseEvent) => {
    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
    setConnectionState('disconnected');
    setWsConnected(false);

    const isNormalClosure = event.code < 4000; // Codes below 4000 are normal/user-initiated
    const isUserInitiated = event.reason?.includes('User') || event.reason?.includes('ended');

    // Special-case heartbeat timeout (4000): try a reconnect before finalizing
    if (event.code === 4000 && !hasEndedRef.current) {
      console.log('🔁 Heartbeat timeout detected - attempting reconnect before finalizing');
      try {
        const reconnected = await retryConnection();
        if (reconnected) {
          console.log('🔌 Reconnected successfully after heartbeat timeout');
          return;
        } else {
          console.warn('⚠️ Reconnect attempts failed after heartbeat timeout, will finalize interview');
        }
      } catch (err) {
        console.error('❌ Reconnect attempt threw error:', err);
      }
      // fallthrough to finalize if reconnect didn't work
    }

    if (isNormalClosure && !hasEndedRef.current) {
      // Normal closure without user action - call endInterview
      endInterview(true);
    } else if (!isUserInitiated && !hasEndedRef.current) {
      // Unexpected disconnect - finalize interview anyway
      console.log('🔌 Unexpected disconnect, finalizing interview...');
      endInterview(true);
      
      // Show error for unexpected disconnections
      const errorMsg = `Connection lost (${event.code}): ${event.reason || 'Unknown error'}`;
      setConnectionError(errorMsg);
      
      if (event.code === 4004 || event.code === 1006) {
        setShowRetryButton(true);
      }
      
      toast({ 
        title: "Connection Lost", 
        description: errorMsg, 
        variant: "destructive" 
      });
    }
  }, [toast]);

  // Retry connection function
  const retryConnection = async (): Promise<boolean> => {
    setShowRetryButton(false);
    setConnectionError(null);
    setIsLoading(true);
    
    try {
      // Clean up existing connections
      await cleanupResources();
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restart the interview (this will recreate session/ws)
      await startVideoInterview();
      return true;
    } catch (error) {
      console.error('❌ Retry failed:', error);
      setShowRetryButton(true);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // This is the new "Start" function
  const startVideoInterview = async () => {
    if (hasEndedRef.current) return;
    
    setIsLoading(true);
    setConnectionState('connecting');
    setConnectionError(null);
    
    try {
      console.log('🎬 Starting video interview for:', interviewId);
      
      // Step 1: Initialize AudioPlayer (requires user gesture)
      audioPlayerRef.current = new AudioPlayer();
      await audioPlayerRef.current.initialize();
      console.log('🔊 AudioPlayer initialized');

      // Step 2: Set up local video/audio stream 
      console.log('🎥 Requesting user media (video + audio)...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 }, 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('✅ Local media stream acquired');

      // Step 3: Prepare interview context
      console.log('📋 Preparing interview context...');
      await prepareInterviewContext({ interviewId });
      console.log('✅ Interview context prepared');

      // Step 4: Start interview session
      console.log('🚀 Starting interview session...');
      const startResponse = await startInterview({ interview_session_id: interviewId });
      const sessionId = startResponse.session_id;
      setActiveSessionId(sessionId);
      console.log('✅ Interview session started:', startResponse);

      // Step 5: Initialize WebSocket connection using the active session ID
      console.log('🔌 Initializing WebSocket connection...');
      wsManagerRef.current = new InterviewWebSocketManager(handleMessage, handleDisconnect);
      await wsManagerRef.current.connect(sessionId); // Use active session ID
      setWsConnected(true);
      console.log('✅ WebSocket connected successfully');

      // Step 5: Set up audio recorder for streaming to backend
      console.log('🎤 Setting up audio recorder...');
      audioRecorderRef.current = new AudioRecorder({
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16
      });
      
      await audioRecorderRef.current.start((chunk) => {
        if (wsManagerRef.current?.isConnected()) {
          // Convert ArrayBuffer to base64
          const uint8Array = new Uint8Array(chunk.data);
          const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
          wsManagerRef.current.sendAudio(base64);
        }
      });
      console.log('✅ Audio recorder started');

      setInterviewStarted(true);
      setConnectionState('connected');
      toast({ 
        title: "Interview Started", 
        description: "The AI interviewer is ready. You can begin speaking.",
        duration: 3000
      });
      
    } catch (error: any) {
      console.error('❌ Error during startVideoInterview:', error);
      setConnectionState('disconnected');
      setWsConnected(false);
      
      // Clean up on error
      await cleanupResources();
      
      let errorMessage = 'Failed to start interview';
      
      if (error instanceof InterviewApiError) {
        errorMessage = error.message;
        setConnectionError(`API Error: ${error.message}`);
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Connection timeout - please check your network';
        setConnectionError('Connection timeout');
      } else if (error.message?.includes('getUserMedia')) {
        errorMessage = 'Camera/microphone access required';
        setConnectionError('Media access denied');
      } else {
        setConnectionError(error.message || 'Unknown connection error');
      }
      
      toast({ 
        title: "Connection Error", 
        description: errorMessage, 
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to clean up all resources
  const cleanupResources = async () => {
    console.log('🧹 Cleaning up interview resources...');
    
    // Stop audio player
    audioPlayerRef.current?.stopAndClearQueue();
    
    // Stop audio recorder
    if (audioRecorderRef.current) {
      try {
        await audioRecorderRef.current.stop();
        console.log('✅ Audio recorder stopped');
      } catch (error) {
        console.warn('⚠️ Error stopping audio recorder:', error);
      }
      audioRecorderRef.current = null;
    }
    
    // Stop local media stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`✅ Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }
    
    // Clear video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const endInterview = async (isAutoEnd = false) => {
    if (hasEndedRef.current) {
      console.log('🛑 endInterview called but already ended, skipping');
      return;
    }
    hasEndedRef.current = true;

    console.log(`🛑 Ending interview (auto: ${isAutoEnd}), messages count: ${messages.length}, activeSessionId: ${activeSessionId}, interviewId: ${interviewId}`);
    setIsLoading(true);
    
    // Disconnect WebSocket first (only if user initiated)
    if (!isAutoEnd && wsManagerRef.current) {
      wsManagerRef.current.disconnect(true);
    }
    
    // Clean up all resources
    await cleanupResources();
    setWsConnected(false);

    try {
        // Only call finalize if an interview was actually started or there's an active session
        const finalInterviewId = activeSessionId || interviewId;
        const shouldFinalize = interviewStarted || activeSessionId !== null;

        if (shouldFinalize) {
          console.log('💾 Finalizing interview session...', { finalInterviewId, messagesCount: messages.length });
          await finalizeInterview({ 
            interviewId: finalInterviewId, 
            transcript: messages 
          });
          console.log('✅ Interview finalized successfully');
        } else {
          console.log('ℹ️ Skipping finalize: no active interview session or interview was not started');
        }
      
      if (messages.length > 0) {
        toast({ 
          title: "Interview Saved", 
          description: "Your interview has been processed and saved.",
          duration: 3000
        });
      } else {
        toast({ 
          title: "Interview Ended", 
          description: "Interview session finalized.",
          duration: 3000
        });
      }
      
  onInterviewComplete();
    } catch (error: any) {
      console.error('❌ Error during endInterview:', error);
      
      let errorMessage = 'Failed to save interview';
      if (error instanceof InterviewApiError) {
        errorMessage = error.message;
      }
      
      toast({ 
        title: "Error Saving Interview", 
        description: errorMessage, 
        variant: "destructive",
        duration: 5000
      });
      
  // Still complete the interview even if save failed
  onInterviewComplete();
    } finally {
      setIsLoading(false);
      setConnectionState('disconnected');
      setInterviewCompleted(true);
    }
  };

  const handleViewResults = async () => {
    try {
      const useId = activeSessionId || interviewId;
      console.log('Fetching interview results from database for session ID:', useId);
      
      const { data: session, error } = await supabase
        .from('interview_sessions')
        .select('ai_analysis, overall_score, strengths, areas_for_improvement, recommendations')
        .eq('id', useId)
        .single();

      if (error) {
        console.error('Error fetching interview results:', error);
        throw error;
      }

      console.log('Interview results fetched:', session);
      setInterviewResults(session.ai_analysis || {
        summary: 'No analysis available',
        strengths: session.strengths || [],
        weaknesses: session.areas_for_improvement || [],
        score: session.overall_score || 0,
        job_fit: 'Not assessed'
      });
      setShowResults(true);
    } catch (error) {
      console.error('Error fetching interview results:', error);
      // Fallback to showing basic results
      setInterviewResults({
        summary: 'Unable to load analysis data',
        strengths: [],
        weaknesses: [],
        score: 0,
        job_fit: 'Not assessed'
      });
      setShowResults(true);
    }
  };

  const handleCloseResults = () => {
    if (initialShowResults) {
      // Close the parent dialog when this modal was opened just to view results
      onInterviewComplete();
    } else {
      setShowResults(false);
    }
  };

  // Your UI toggle functions remain the same
  const toggleVideo = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    const videoTrack = stream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };

  // If opened for a completed session, auto-show results
  useEffect(() => {
    if (initialShowResults) {
      console.log('CandidateAiInterviewModal mounted with initialShowResults=true, fetching results...');
      handleViewResults();
    }
  }, [initialShowResults]);

  const toggleAudio = async () => {
    if (audioRecorderRef.current) {
      if (isAudioEnabled) { // If it was enabled, now we want to mute (stop recording)
        await audioRecorderRef.current.stop();
        toast({ title: "Mic Muted", description: "The AI will no longer hear you." });
      } else { // If it was muted, now we want to unmute (start recording)
        await audioRecorderRef.current.start((chunk) => {
          if (wsManagerRef.current?.isConnected()) {
            // Convert ArrayBuffer to base64
            const uint8Array = new Uint8Array(chunk.data);
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
            wsManagerRef.current.sendAudio(base64);
          }
        });
        toast({ title: "Mic Unmuted", description: "The AI can now hear you." });
      }
    }
    
    // Also toggle the preview stream audio track
    const stream = localVideoRef.current?.srcObject as MediaStream;
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isAudioEnabled;
    }
    
    setIsAudioEnabled(prev => !prev); // Toggle the state after recorder is handled
  };
  
  const getConnectionStatusColor = (state: string) => {
    switch (state) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // --- YOUR EXISTING UI (JSX) REMAINS UNCHANGED ---
  return (
    <div className="h-full w-full flex flex-col p-6">
      {/* Only show the full interview header when not opening solely to view results */}
      {!initialShowResults && (
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">AI Interview: {jobTitle}</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>
      )}

      {/* If opened specifically to show results, hide the interviewer UI */}
      {!initialShowResults && (
        <>
          <Card className="my-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${ 
                    connectionState === 'connected' ? 'bg-green-500' : 
                    connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                    'bg-red-500' 
                  }`} />
                  <span className={`text-sm font-medium ${getConnectionStatusColor(connectionState)}`}>
                    {connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}
                    {wsConnected && connectionState === 'connected' && ' (Live)'}
                  </span>
                  {connectionError && (
                    <span className="text-xs text-red-500 ml-2">• {connectionError}</span>
                  )}
                  {showRetryButton && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={retryConnection}
                      disabled={isLoading}
                      className="ml-2"
                    >
                      {isLoading ? 'Retrying...' : 'Retry'}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isSpeaking && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Bot className="w-3 h-3" /> AI Speaking...
                    </Badge>
                  )}
                  {connectionState === 'connecting' && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex-1 flex gap-4">
            <Card className="w-1/2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Video</CardTitle></CardHeader>
              <CardContent className="p-4">
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  {!isVideoEnabled && <div className="absolute inset-0 bg-gray-800 flex items-center justify-center"><VideoOff className="w-12 h-12 text-gray-400" /></div>}
                </div>
              </CardContent>
            </Card>

            <Card className="w-1/2">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4" /> AI Interviewer</CardTitle></CardHeader>
              <CardContent className="p-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 aspect-video flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-4"><Bot className="w-10 h-10 text-white" /></div>
                  <h3 className="font-semibold text-lg mb-2">AI Interviewer</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">{isSpeaking ? 'Speaking...' : (connectionState === 'connected' ? 'Listening...' : 'Idle')}</p>
                  {isSpeaking && <div className="flex gap-1"><div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardContent className="p-4">
              {!interviewStarted ? (
                <div className="text-center">
                  <Button onClick={startVideoInterview} disabled={isLoading} size="lg" className="px-8">
                    {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Connecting...</> : <><Play className="w-5 h-5 mr-2" />Start Video Interview</>}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">Click to begin your AI-powered video interview</p>
                </div>
              ) : interviewCompleted ? (
                <div className="text-center">
                  <Button onClick={() => handleViewResults()} size="lg" className="px-8">
                    <Bot className="w-5 h-5 mr-2" />
                    View Results
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">Your interview has been completed. Click to view AI analysis.</p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant={isVideoEnabled ? "default" : "secondary"} size="sm" onClick={toggleVideo}>{isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</Button>
                    <Button variant={isAudioEnabled ? "default" : "secondary"} size="sm" onClick={toggleAudio}>{isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</Button>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={() => endInterview()} disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <PhoneOff className="w-4 h-4 mr-2" />}
                      {isLoading ? "Saving..." : "End Interview"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Results Modal - show a single AI Results column based on JSON schema */}
      {/* If opened solely to view results, render inline content and do not render the overlay */}
      {initialShowResults && showResults && interviewResults && (
        <Card className="max-w-3xl w-full mx-auto">
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
            <div className="ml-auto">
              <Button variant="outline" onClick={handleCloseResults}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh]">
              {(initialShowResults || showResults) && interviewResults && interviewResults.score !== undefined && (
                <div className="mb-4 p-4 bg-gray-50 rounded border text-center">
                  <div className="text-sm text-muted-foreground">Overall Score</div>
                  <div className="text-3xl font-bold text-primary">{interviewResults.score}/100</div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 border rounded">
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-gray-700">{interviewResults.summary || 'No summary available'}</p>
                </div>

                <div className="p-4 border rounded flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Overall Score</h3>
                    <div className="text-3xl font-bold text-primary">{interviewResults.score ?? 0}/100</div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-semibold">Job Fit</h3>
                    <p className="text-gray-700">{interviewResults.job_fit || 'Not_Assessed'}</p>
                  </div>
                </div>

                {interviewResults.skills_assessment && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">Skills Assessment</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {interviewResults.skills_assessment.agenda_modules && Object.entries(interviewResults.skills_assessment.agenda_modules).map(([moduleName, metrics]: any) => (
                        <div key={moduleName} className="mb-2">
                          <div className="font-medium">{moduleName}</div>
                          <ul className="text-sm text-gray-700 list-disc list-inside">
                            {Object.entries(metrics).map(([metric, value]: any) => (
                              <li key={metric}>{metric}: {value}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {interviewResults.module_performance && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">Module Performance</h3>
                    <ul className="text-sm text-gray-700 list-disc list-inside">
                      {Object.entries(interviewResults.module_performance).map(([m, v]: any) => (
                        <li key={m}>{m}: {v}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {interviewResults.assessment_fairness && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">Assessment Fairness</h3>
                    <p className="text-sm text-gray-700 mb-2">{interviewResults.assessment_fairness.notes}</p>
                    {interviewResults.fairness_adjustments && (
                      <ul className="text-sm text-gray-700 list-disc list-inside">
                        {interviewResults.fairness_adjustments.map((adj: any, idx: number) => (
                          <li key={idx}>{adj.module}: {adj.adjustment}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {showResults && interviewResults && !initialShowResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">AI Analysis</h2>
                <Button variant="outline" onClick={handleCloseResults}>
                  Close
                </Button>
              </div>

              {/* Prominent score banner when showing results-only view or when results are visible */}
              {(initialShowResults || showResults) && interviewResults && interviewResults.score !== undefined && (
                <div className="mb-4 p-4 bg-gray-50 rounded border text-center">
                  <div className="text-sm text-muted-foreground">Overall Score</div>
                  <div className="text-3xl font-bold text-primary">{interviewResults.score}/100</div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* Summary */}
                <div className="p-4 border rounded">
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-gray-700">{interviewResults.summary || 'No summary available'}</p>
                </div>

                {/* Score & Job Fit */}
                <div className="p-4 border rounded flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Overall Score</h3>
                    <div className="text-3xl font-bold text-primary">{interviewResults.score ?? 0}/100</div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-semibold">Job Fit</h3>
                    <p className="text-gray-700">{interviewResults.job_fit || 'Not_Assessed'}</p>
                  </div>
                </div>

                {/* Skills Assessment (Agenda Modules) */}
                {interviewResults.skills_assessment && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">Skills Assessment</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {interviewResults.skills_assessment.agenda_modules && Object.entries(interviewResults.skills_assessment.agenda_modules).map(([moduleName, metrics]: any) => (
                        <div key={moduleName} className="mb-2">
                          <div className="font-medium">{moduleName}</div>
                          <ul className="text-sm text-gray-700 list-disc list-inside">
                            {Object.entries(metrics).map(([metric, value]: any) => (
                              <li key={metric}>{metric}: {value}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Module Performance */}
                {interviewResults.module_performance && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">Module Performance</h3>
                    <ul className="text-sm text-gray-700 list-disc list-inside">
                      {Object.entries(interviewResults.module_performance).map(([m, v]: any) => (
                        <li key={m}>{m}: {v}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Assessment Fairness & Adjustments */}
                {interviewResults.assessment_fairness && (
                  <div className="p-4 border rounded">
                    <h3 className="text-lg font-semibold mb-2">Assessment Fairness</h3>
                    <p className="text-sm text-gray-700 mb-2">{interviewResults.assessment_fairness.notes}</p>
                    {interviewResults.fairness_adjustments && (
                      <ul className="text-sm text-gray-700 list-disc list-inside">
                        {interviewResults.fairness_adjustments.map((adj: any, idx: number) => (
                          <li key={idx}>{adj.module}: {adj.adjustment}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateAiInterviewModal;