import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  User,
  Bot
} from 'lucide-react';
import { finalizeInterview } from '@/services/interviewApi';
import { supabase } from "@/integrations/supabase/client";

interface InterviewMessage {
  id: string;
  speaker: 'interviewer' | 'candidate';
  message: string;
  timestamp: Date;
  type?: 'question' | 'answer' | 'system';
}

interface AIInterviewWindowProps {
  sessionId: string;
  employeeName: string;
  jobTitle: string;
  onEndInterview: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function AIInterviewWindow({
  sessionId,
  employeeName,
  jobTitle,
  onEndInterview,
  isFullscreen = false,
  onToggleFullscreen
}: AIInterviewWindowProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [audioTestStatus, setAudioTestStatus] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [interviewResults, setInterviewResults] = useState<any>(null);
  const [finalizingInterview, setFinalizingInterview] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = () => {
      // Use the correct WebSocket URL for your AI interviewer backend
      const wsUrl = `ws://localhost:8000/ws/interview/${sessionId}`;
      console.log('Connecting to AI interviewer WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected to AI interviewer');
        setConnectionStatus('connected');
        setIsConnected(true);
        
        // Add system message
        const systemMessage: InterviewMessage = {
          id: Date.now().toString(),
          speaker: 'interviewer',
          message: `Welcome ${employeeName}! I'm your AI interviewer for the ${jobTitle} position. Let's begin when you're ready.`,
          timestamp: new Date(),
          type: 'system'
        };
        setMessages([systemMessage]);
      };

      wsRef.current.onmessage = (event) => {
        try {
          console.log('📥 Received WebSocket message:', event.data);
          const data = JSON.parse(event.data);
          
          // Enhanced logging for audio chunks and connection stability
          if (data.type === 'response.audio.delta') {
            console.log('🔊 Audio chunk received:', {
              timestamp: new Date().toISOString(),
              size: data.audio ? data.audio.length : 0,
              connectionStable: wsRef.current?.readyState === WebSocket.OPEN
            });
          } else if (data.type === 'input_audio_buffer.speech_started') {
            console.log('🎤 Speech detection started:', new Date().toISOString());
          } else if (data.type === 'input_audio_buffer.speech_stopped') {
            console.log('🎤 Speech detection stopped:', new Date().toISOString());
          } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('📝 Transcript received:', {
              timestamp: new Date().toISOString(),
              transcript: data.transcript,
              connectionStable: wsRef.current?.readyState === WebSocket.OPEN
            });
          }
          
          // Handle different message types from your AI interviewer
          if (data.type === 'assistant_message' || data.type === 'question' || data.type === 'response.text.done') {
            const questionMessage: InterviewMessage = {
              id: Date.now().toString(),
              speaker: 'interviewer',
              message: data.content || data.text || data.message,
              timestamp: new Date(),
              type: 'question'
            };
            setMessages(prev => [...prev, questionMessage]);
            setCurrentQuestion(data.content || data.text || data.message);
          } else if (data.type === 'user_transcript' || data.type === 'transcript' || data.type === 'conversation.item.input_audio_transcription.completed') {
            const answerMessage: InterviewMessage = {
              id: Date.now().toString(),
              speaker: 'candidate',
              message: data.content || data.text || data.message || data.transcript,
              timestamp: new Date(),
              type: 'answer'
            };
            setMessages(prev => [...prev, answerMessage]);
          } else if (data.type === 'interview_started') {
            console.log('✅ Interview started successfully');
          } else if (data.type === 'interview_ended') {
            console.log('🔚 Interview ended');
            setConnectionStatus('disconnected');
            setIsConnected(false);
          } else if (data.type === 'error') {
            console.error('❌ Interview error:', data.message);
            setConnectionStatus('disconnected');
            setIsConnected(false);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected from AI interviewer');
        setConnectionStatus('disconnected');
        setIsConnected(false);
        // Call finalize API immediately after WebSocket disconnect
        endInterview();
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        setIsConnected(false);
      };
    };

    if (sessionId) {
      initializeWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId, employeeName, jobTitle]);

  // Debug modal state
  useEffect(() => {
    console.log('Modal state changed - showResults:', showResults, 'interviewResults exists:', !!interviewResults);
  }, [showResults, interviewResults]);

  // Initialize camera
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setIsVideoEnabled(false);
      }
    };

    if (isVideoEnabled) {
      initializeCamera();
    }
  }, [isVideoEnabled]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    // Send audio toggle to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'toggle_audio',
        enabled: !isAudioEnabled
      }));
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
  };

  // Audio testing functionality
  const startAudioTest = async () => {
    try {
      setIsTestingAudio(true);
      setAudioTestStatus('recording');
      console.log('🎤 Starting audio test:', new Date().toISOString());

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      mediaStreamRef.current = stream;

      // Create audio context and analyser for level monitoring
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Monitor audio levels
      const updateAudioLevel = () => {
        if (analyserRef.current && isTestingAudio) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Send test audio to WebSocket if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('📤 Sending test audio chunks to WebSocket');
        
        // Create media recorder for testing
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            console.log('📤 Audio chunk sent:', {
              timestamp: new Date().toISOString(),
              size: event.data.size,
              connectionStable: wsRef.current?.readyState === WebSocket.OPEN
            });

            // Convert to base64 and send
            const reader = new FileReader();
            reader.onload = () => {
              const base64Audio = (reader.result as string).split(',')[1];
              wsRef.current?.send(JSON.stringify({
                type: 'audio_test',
                audio: base64Audio,
                timestamp: new Date().toISOString()
              }));
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorder.start(100); // 100ms chunks

        // Stop test after 3 seconds
        setTimeout(() => {
          stopAudioTest();
          setAudioTestStatus('success');
          console.log('✅ Audio test completed successfully');
        }, 3000);
      } else {
        console.warn('⚠️ WebSocket not connected - testing microphone only');
        setTimeout(() => {
          stopAudioTest();
          setAudioTestStatus('success');
        }, 3000);
      }

    } catch (error) {
      console.error('❌ Audio test failed:', error);
      setAudioTestStatus('error');
      stopAudioTest();
    }
  };

  const stopAudioTest = () => {
    setIsTestingAudio(false);
    setAudioLevel(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setTimeout(() => {
      setAudioTestStatus('idle');
    }, 2000);
  };

  // Connection stability monitoring
  useEffect(() => {
    let stabilityInterval: NodeJS.Timeout;
    
    if (connectionStatus === 'connected' && wsRef.current) {
      stabilityInterval = setInterval(() => {
        if (wsRef.current) {
          const isStable = wsRef.current.readyState === WebSocket.OPEN;
          console.log('🔗 Connection stability check:', {
            timestamp: new Date().toISOString(),
            readyState: wsRef.current.readyState,
            stable: isStable,
            url: wsRef.current.url
          });
          
          if (!isStable) {
            console.warn('⚠️ Connection unstable, ready state:', wsRef.current.readyState);
          }
        }
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (stabilityInterval) {
        clearInterval(stabilityInterval);
      }
    };
  }, [connectionStatus]);

  const endInterview = async () => {
    try {
      setFinalizingInterview(true);
      
      // Send end interview message to WebSocket
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'end_interview'
        }));
        wsRef.current.close();
      }
      
      // Stop camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Call finalize API immediately after disconnect
      console.log('Finalizing interview with session ID:', sessionId);
      const finalizeResponse = await finalizeInterview({
        interviewId: sessionId,
        transcript: messages.map(msg => ({
          speaker: msg.speaker,
          content: msg.message,
          type: msg.type || 'text',
          timestamp: msg.timestamp.getTime() / 1000
        }))
      });
      
      console.log('Interview finalized successfully:', finalizeResponse);
      setInterviewCompleted(true);
      setInterviewResults(finalizeResponse);
      
    } catch (error) {
      console.error('Error finalizing interview:', error);
      setInterviewCompleted(true); // Still mark as completed even if finalize fails
    } finally {
      setFinalizingInterview(false);
      onEndInterview();
    }
  };

  const handleShowResults = async () => {
    try {
      console.log('Fetching interview results from database for session ID:', sessionId);
      
      const { data: session, error } = await supabase
        .from('interview_sessions')
        .select('ai_analysis, overall_score, strengths, areas_for_improvement, recommendations')
        .eq('id', sessionId)
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
      console.log('Setting showResults to true');
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
      console.log('Setting showResults to true in catch block');
      setShowResults(true);
    }
  };

  const handleCloseResults = () => {
    setShowResults(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'} flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">{employeeName}</h3>
              <p className="text-sm text-muted-foreground">{jobTitle} Assessment</p>
            </div>
          </div>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus === 'connected' ? 'Live' : 'Disconnected'}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onToggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Panel */}
        <div className="w-1/3 border-r bg-card">
          <div className="p-4">
            <h4 className="font-medium mb-3">Interview Participant</h4>
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              {isVideoEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <VideoOff className="h-12 w-12 mx-auto mb-2" />
                    <p>Camera Off</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Controls */}
            <div className="flex justify-center space-x-2 mt-4">
              <Button 
                variant={isAudioEnabled ? "default" : "destructive"} 
                size="sm"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button 
                variant={isVideoEnabled ? "default" : "destructive"} 
                size="sm"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button 
                variant={isMuted ? "destructive" : "default"} 
                size="sm"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              {/* Test Sound Button */}
              <Button 
                variant={audioTestStatus === 'success' ? "default" : audioTestStatus === 'error' ? "destructive" : "outline"}
                size="sm"
                onClick={isTestingAudio ? stopAudioTest : startAudioTest}
                disabled={audioTestStatus === 'processing'}
                className="relative"
              >
                <Volume2 className="h-4 w-4 mr-1" />
                {isTestingAudio ? 'Testing...' : 'Test Sound'}
                {audioTestStatus === 'success' && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                )}
                {audioTestStatus === 'error' && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
                )}
              </Button>
            </div>
            
            {/* Audio Level Indicator */}
            {(isTestingAudio || audioLevel > 0) && (
              <div className="mt-2 px-4">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  <span>Audio Level:</span>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-100 ${
                        audioLevel > 50 ? 'bg-green-500' : audioLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs min-w-[2rem]">{Math.round(audioLevel)}</span>
                </div>
              </div>
            )}
            
            {/* Audio Test Status */}
            {audioTestStatus !== 'idle' && (
              <div className="mt-2 px-4">
                <div className={`text-xs text-center p-2 rounded ${
                  audioTestStatus === 'success' ? 'bg-green-100 text-green-700' :
                  audioTestStatus === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {audioTestStatus === 'recording' && '🎤 Recording audio test...'}
                  {audioTestStatus === 'processing' && '⏳ Processing...'}
                  {audioTestStatus === 'success' && '✅ Audio test successful! Microphone is working.'}
                  {audioTestStatus === 'error' && '❌ Audio test failed. Check microphone permissions.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Panel */}
        <div className="flex-1 flex flex-col">
          {/* Current Question */}
          {currentQuestion && (
            <div className="p-4 bg-muted/50 border-b">
              <div className="flex items-start space-x-3">
                <Bot className="h-6 w-6 text-blue-600 mt-1" />
                <div>
                  <p className="font-medium text-sm text-muted-foreground mb-1">Current Question</p>
                  <p className="text-sm">{currentQuestion}</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    message.speaker === 'interviewer' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {message.speaker === 'interviewer' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium">
                        {message.speaker === 'interviewer' ? 'AI Interviewer' : employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</p>
                      {message.type && (
                        <Badge variant="outline" className="text-xs">
                          {message.type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{message.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Footer Controls */}
          <div className="p-4 border-t bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full animate-pulse ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="font-mono">
                    {connectionStatus === 'connected' ? 'LIVE' : 
                     connectionStatus === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'}
                  </span>
                </div>
                
                <Separator orientation="vertical" className="h-4" />
                
                <div className="flex items-center space-x-1">
                  <span>Session:</span>
                  <code className="px-1 py-0.5 bg-muted rounded text-xs">{sessionId.slice(-8)}</code>
                </div>
                
                {wsRef.current && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center space-x-1">
                      <span>WebSocket:</span>
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">
                        {wsRef.current.readyState === WebSocket.OPEN ? 'OPEN' :
                         wsRef.current.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                         wsRef.current.readyState === WebSocket.CLOSING ? 'CLOSING' : 'CLOSED'}
                      </code>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {interviewCompleted ? (
                  <Button 
                    variant="default" 
                    onClick={handleShowResults}
                    className="flex items-center space-x-2"
                  >
                    <Bot className="h-4 w-4" />
                    <span>View Results</span>
                  </Button>
                ) : (
                  <Button 
                    variant="destructive" 
                    onClick={endInterview}
                    disabled={finalizingInterview}
                    className="flex items-center space-x-2"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>{finalizingInterview ? 'Finalizing...' : 'End Interview'}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      {showResults && interviewResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Interview Results</h2>
                <Button variant="outline" onClick={handleCloseResults}>
                  Close
                </Button>
              </div>
              
              <div className="space-y-6">
                {interviewResults.summary && (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Analysis Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{interviewResults.summary}</p>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.strengths && interviewResults.strengths.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Strengths</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {interviewResults.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-gray-700">{strength}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.weaknesses && interviewResults.weaknesses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Areas for Improvement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {interviewResults.weaknesses.map((weakness: string, index: number) => (
                          <li key={index} className="text-gray-700">{weakness}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.score !== undefined && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Overall Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          {interviewResults.score}/100
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div 
                            className="bg-blue-600 h-4 rounded-full" 
                            style={{ width: `${interviewResults.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.job_fit && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Job Fit Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{interviewResults.job_fit}</p>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.target_role && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Target Role</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{interviewResults.target_role}</p>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.employee_name && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Employee Name</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{interviewResults.employee_name}</p>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.current_position && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Position</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{interviewResults.current_position}</p>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.job_requirements && interviewResults.job_requirements.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Job Requirements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-1">
                        {interviewResults.job_requirements.map((req: string, index: number) => (
                          <li key={index} className="text-gray-700">{req}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.skills_assessment && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Skills Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {interviewResults.skills_assessment.agenda_modules && (
                          <div>
                            <h4 className="font-semibold mb-2">Agenda Modules</h4>
                            <div className="space-y-1">
                              {Object.entries(interviewResults.skills_assessment.agenda_modules).map(([module, status]: [string, any]) => (
                                <div key={module} className="flex justify-between">
                                  <span className="text-gray-700">{module}:</span>
                                  <span className="text-gray-600">{status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {interviewResults.skills_assessment.required_skills && (
                          <div>
                            <h4 className="font-semibold mb-2">Required Skills</h4>
                            <p className="text-gray-700">{interviewResults.skills_assessment.required_skills}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {interviewResults.detailed_evaluation && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Detailed Evaluation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {interviewResults.detailed_evaluation.module_performance && (
                          <div>
                            <h4 className="font-semibold mb-2">Module Performance</h4>
                            <div className="space-y-1">
                              {Object.entries(interviewResults.detailed_evaluation.module_performance).map(([module, performance]: [string, any]) => (
                                <div key={module} className="flex justify-between">
                                  <span className="text-gray-700">{module}:</span>
                                  <span className="text-gray-600">{performance}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {interviewResults.detailed_evaluation.assessment_fairness && (
                          <div>
                            <h4 className="font-semibold mb-2">Assessment Fairness</h4>
                            <p className="text-gray-700">{interviewResults.detailed_evaluation.assessment_fairness}</p>
                          </div>
                        )}
                        {interviewResults.detailed_evaluation.fairness_adjustments && interviewResults.detailed_evaluation.fairness_adjustments.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Fairness Adjustments</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {interviewResults.detailed_evaluation.fairness_adjustments.map((adjustment: string, index: number) => (
                                <li key={index} className="text-gray-700">{adjustment}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}