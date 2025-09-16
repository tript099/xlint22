// src/components/modals/CandidateAiInterviewModal.tsx (DEFINITIVE VERSION)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { InterviewWebSocketManager } from '@/utils/InterviewWebSocketManager';
import { AudioRecorder } from '@/utils/AudioRecorder';
import { Video, VideoOff, Mic, MicOff, Bot, Loader2, Play, PhoneOff } from 'lucide-react';
import { AudioPlayer } from '@/utils/AudioPlayer';
import { startDatabaseInterview, finalizeInterview, InterviewApiError } from '@/services/interviewApi';

interface CandidateAiInterviewModalProps {
  interviewId: string;
  jobTitle: string;
  companyName: string;
  onInterviewComplete: () => void;
}

// We will store the full event log to build the transcript at the end
interface InterviewMessage {
  type: string;
  [key: string]: any; // Store the full event
}

const CandidateAiInterviewModal = ({ interviewId, jobTitle, companyName, onInterviewComplete }: CandidateAiInterviewModalProps) => {
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
  const [wsConnected, setWsConnected] = useState(false);
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

  const handleDisconnect = useCallback((event: CloseEvent) => {
    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
    setConnectionState('disconnected');
    setWsConnected(false);
    
    const isNormalClosure = event.code < 4000; // Codes below 4000 are normal/user-initiated
    const isUserInitiated = event.reason?.includes('User') || event.reason?.includes('ended');

    if (isNormalClosure && !hasEndedRef.current) {
      // Normal closure without user action - call endInterview
      endInterview(true);
    } else if (!isUserInitiated && !hasEndedRef.current) {
      // Unexpected disconnect - show error with code + reason
      const errorMsg = `Connection lost (${event.code}): ${event.reason || 'Unknown error'}`;
      setConnectionError(errorMsg);
      
      // Show retry button for 4004 (session not found) or connection issues
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
  const retryConnection = async () => {
    setShowRetryButton(false);
    setConnectionError(null);
    setIsLoading(true);
    
    try {
      // Clean up existing connections
      await cleanupResources();
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restart the interview
      await startVideoInterview();
    } catch (error) {
      console.error('❌ Retry failed:', error);
      setShowRetryButton(true);
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

      // Step 2: Call backend to start interview session
      console.log('📞 Calling start-database-interview API...');
      const data = await startDatabaseInterview(interviewId);
      const { session_id } = data;
      console.log('✅ Interview session created:', session_id);

      // Step 3: Set up local video/audio stream 
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

      // Step 4: Initialize WebSocket connection
      console.log('🔌 Initializing WebSocket connection...');
      wsManagerRef.current = new InterviewWebSocketManager(handleMessage, handleDisconnect);
      await wsManagerRef.current.connect(session_id);
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
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    console.log(`🛑 Ending interview (auto: ${isAutoEnd})`);
    setIsLoading(true);
    
    // Disconnect WebSocket first (only if user initiated)
    if (!isAutoEnd && wsManagerRef.current) {
      wsManagerRef.current.disconnect(true);
    }
    
    // Clean up all resources
    await cleanupResources();
    setWsConnected(false);

    try {
      // Call finalize endpoint only if we have messages to save
      if (messages.length > 0) {
        console.log('💾 Saving interview transcript...');
        await finalizeInterview({ 
          interviewId, 
          transcript: messages 
        });
        console.log('✅ Interview transcript saved');
        
        toast({ 
          title: "Interview Saved", 
          description: "Your interview has been processed and saved.",
          duration: 3000
        });
      } else {
        toast({ 
          title: "Interview Ended", 
          description: "Interview ended without transcript.",
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
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">AI Interview: {jobTitle}</DialogTitle>
        <DialogDescription>{companyName}</DialogDescription>
      </DialogHeader>

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
    </div>
  );
};

export default CandidateAiInterviewModal;