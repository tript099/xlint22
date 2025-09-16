# 🎯 AI Interview System - React Integration

A comprehensive React TypeScript integration for the AI-powered internal interview system. This frontend provides a modern, responsive interface for conducting live AI interviews with real-time transcription, automated agenda generation, and comprehensive evaluation analytics.

## 🚀 Features

- **Live Interview Interface** - Real-time audio/video communication with AI interviewer
- **Real-time Transcription** - Live speech-to-text with instant display
- **Interview Management** - Start, monitor, and finalize interviews
- **Agenda Visualization** - Interactive meeting agenda with progress tracking
- **Evaluation Dashboard** - Comprehensive AI-powered interview analysis
- **WebSocket Integration** - Low-latency real-time communication
- **Responsive Design** - Mobile-friendly interface with modern UI
- **TypeScript Support** - Full type safety and IntelliSense
- **Error Handling** - Robust error boundaries and user feedback

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Project Setup](#project-setup)
4. [API Integration](#api-integration)
5. [WebSocket Setup](#websocket-setup)
6. [Component Examples](#component-examples)
7. [TypeScript Types](#typescript-types)
8. [Interview Flow](#interview-flow)
9. [Error Handling](#error-handling)
10. [Deployment](#deployment)

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **React** 18+ with TypeScript
- **Backend Server** running on `http://localhost:8000`
- **WebSocket** support for real-time features
- **Modern Browser** (Chrome 88+, Firefox 85+, Safari 14+)

## 🛠️ Installation

### 1. Create React App with TypeScript
```bash
npx create-react-app interview-client --template typescript
cd interview-client
```

### 2. Install Dependencies
```bash
npm install axios socket.io-client @types/socket.io-client
npm install @mui/material @emotion/react @emotion/styled
npm install react-router-dom @types/react-router-dom
npm install @mui/icons-material
```

### 3. Install Development Dependencies
```bash
npm install --save-dev @types/node typescript
```

## ⚙️ Project Setup

### Environment Configuration
Create a `.env` file in your React project root:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
REACT_APP_MAX_RETRY_ATTEMPTS=3
REACT_APP_CONNECTION_TIMEOUT=5000
```

### Project Structure
```
src/
├── components/
│   ├── InterviewSession.tsx
│   ├── LiveTranscript.tsx
│   ├── AgendaProgress.tsx
│   ├── EvaluationResults.tsx
│   └── ErrorBoundary.tsx
├── hooks/
│   ├── useInterview.ts
│   ├── useWebSocket.ts
│   └── useApi.ts
├── services/
│   ├── api.ts
│   ├── websocket.ts
│   └── types.ts
├── utils/
│   ├── formatters.ts
│   └── validators.ts
├── App.tsx
└── index.tsx
```

## 🔌 API Integration

### Base API Service
```typescript
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
```

### Interview API Methods
```typescript
// src/services/interviewApi.ts
import api from './api';

export interface InterviewRequest {
  interviewSessionId: string;
}

export interface FinalizeRequest {
  interviewId: string;
  transcript: any[];
}

export const interviewApi = {
  // Start new interview session
  startInterview: async (data: InterviewRequest) => {
    const response = await api.post('/start-interview', data);
    return response.data;
  },

  // Get interview status
  getInterviewStatus: async (sessionId: string) => {
    const response = await api.get(`/interview/${sessionId}/status`);
    return response.data;
  },

  // Get live transcript
  getLiveTranscript: async (interviewId: string) => {
    const response = await api.get(`/interview/${interviewId}/live-transcript`);
    return response.data;
  },

  // Finalize interview with AI analysis
  finalizeInterview: async (data: FinalizeRequest) => {
    const response = await api.post('/finalize-interview', data);
    return response.data;
  },

  // Get interview report
  getInterviewReport: async (interviewId: string) => {
    const response = await api.get(`/interview/${interviewId}/report`);
    return response.data;
  },
};

export default interviewApi;
```

## 🌐 WebSocket Setup

### WebSocket Service
```typescript
// src/services/websocket.ts
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  connect(sessionId: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

      this.socket = io(WS_URL, {
        query: { sessionId },
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect to WebSocket server'));
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
```

## 🪝 Custom Hooks

### Interview Hook
```typescript
// src/hooks/useInterview.ts
import { useState, useEffect, useCallback } from 'react';
import interviewApi, { InterviewRequest, FinalizeRequest } from '../services/interviewApi';
import wsService from '../services/websocket';

export interface InterviewState {
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'active' | 'completed' | 'error';
  transcript: any[];
  agenda: any | null;
  error: string | null;
}

export const useInterview = () => {
  const [state, setState] = useState<InterviewState>({
    sessionId: null,
    status: 'idle',
    transcript: [],
    agenda: null,
    error: null,
  });

  const startInterview = useCallback(async (interviewSessionId: string) => {
    try {
      setState(prev => ({ ...prev, status: 'connecting', error: null }));

      // Start interview via API
      const response = await interviewApi.startInterview({ interviewSessionId });

      // Connect to WebSocket
      await wsService.connect(response.sessionId);

      setState(prev => ({
        ...prev,
        sessionId: response.sessionId,
        status: 'active',
      }));

      // Listen for transcript updates
      wsService.on('transcript_update', (data) => {
        setState(prev => ({
          ...prev,
          transcript: data.transcript,
        }));
      });

      // Listen for agenda updates
      wsService.on('agenda_update', (data) => {
        setState(prev => ({
          ...prev,
          agenda: data.agenda,
        }));
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start interview',
      }));
    }
  }, []);

  const finalizeInterview = useCallback(async () => {
    if (!state.sessionId) return;

    try {
      await interviewApi.finalizeInterview({
        interviewId: state.sessionId,
        transcript: state.transcript,
      });

      setState(prev => ({ ...prev, status: 'completed' }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to finalize interview',
      }));
    }
  }, [state.sessionId, state.transcript]);

  const endInterview = useCallback(() => {
    wsService.disconnect();
    setState({
      sessionId: null,
      status: 'idle',
      transcript: [],
      agenda: null,
      error: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      wsService.disconnect();
    };
  }, []);

  return {
    ...state,
    startInterview,
    finalizeInterview,
    endInterview,
  };
};
```

## 🧩 Component Examples

### Interview Session Component
```tsx
// src/components/InterviewSession.tsx
import React, { useState } from 'react';
import { useInterview } from '../hooks/useInterview';
import { Button, TextField, Card, CardContent, Typography, Alert } from '@mui/material';
import LiveTranscript from './LiveTranscript';
import AgendaProgress from './AgendaProgress';

const InterviewSession: React.FC = () => {
  const [interviewId, setInterviewId] = useState('');
  const { status, transcript, agenda, error, startInterview, finalizeInterview, endInterview } = useInterview();

  const handleStart = async () => {
    if (interviewId.trim()) {
      await startInterview(interviewId.trim());
    }
  };

  const handleFinalize = async () => {
    await finalizeInterview();
  };

  const handleEnd = () => {
    endInterview();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <Typography variant="h4" gutterBottom>
        AI Interview Session
      </Typography>

      {error && (
        <Alert severity="error" style={{ marginBottom: 20 }}>
          {error}
        </Alert>
      )}

      {status === 'idle' && (
        <Card style={{ marginBottom: 20 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Start New Interview
            </Typography>
            <TextField
              fullWidth
              label="Interview Session ID"
              value={interviewId}
              onChange={(e) => setInterviewId(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleStart}
              disabled={!interviewId.trim()}
            >
              Start Interview
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'connecting' && (
        <Alert severity="info">Connecting to interview session...</Alert>
      )}

      {status === 'active' && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Interview in Progress
              </Typography>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <Button variant="contained" color="secondary" onClick={handleFinalize}>
                  Finalize Interview
                </Button>
                <Button variant="outlined" onClick={handleEnd}>
                  End Interview
                </Button>
              </div>
            </CardContent>
          </Card>

          {agenda && <AgendaProgress agenda={agenda} />}
          <LiveTranscript transcript={transcript} />
        </div>
      )}

      {status === 'completed' && (
        <Alert severity="success">
          Interview completed successfully! Results have been processed.
        </Alert>
      )}
    </div>
  );
};

export default InterviewSession;
```

### Live Transcript Component
```tsx
// src/components/LiveTranscript.tsx
import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';

interface TranscriptEntry {
  speaker: string;
  content: string;
  type: string;
  timestamp: number;
}

interface LiveTranscriptProps {
  transcript: TranscriptEntry[];
}

const LiveTranscript: React.FC<LiveTranscriptProps> = ({ transcript }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Live Transcript
        </Typography>
        <List style={{ maxHeight: 400, overflow: 'auto' }}>
          {transcript.map((entry, index) => (
            <ListItem key={index} divider>
              <ListItemText
                primary={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Chip
                      label={entry.speaker}
                      color={entry.speaker === 'user' ? 'primary' : 'secondary'}
                      size="small"
                    />
                    <Typography variant="body2" color="textSecondary">
                      {new Date(entry.timestamp * 1000).toLocaleTimeString()}
                    </Typography>
                  </div>
                }
                secondary={entry.content}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default LiveTranscript;
```

## 📝 TypeScript Types

```typescript
// src/services/types.ts

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Interview Types
export interface InterviewSession {
  id: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  employee_id: string;
  job_description_id: string;
  started_at?: string;
  completed_at?: string;
  transcript?: any[];
  ai_analysis?: any;
}

export interface AgendaModule {
  title: string;
  duration_minutes: number;
  objectives: string[];
  evaluation_criteria: string[];
  topics?: any[];
}

export interface MeetingAgenda {
  total_duration_minutes: number;
  modules: AgendaModule[];
  generated_at: string;
}

// Transcript Types
export interface TranscriptEntry {
  speaker: string;
  content: string;
  type: 'audio' | 'text' | 'system';
  timestamp: number;
}

// Evaluation Types
export interface InterviewEvaluation {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  score: number;
  skills_assessment: Record<string, any>;
  job_fit: string;
  module_performance?: Record<string, string>;
  assessment_fairness?: any;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface TranscriptUpdateMessage extends WebSocketMessage {
  type: 'transcript_update';
  data: {
    transcript: TranscriptEntry[];
    session_id: string;
  };
}

export interface AgendaUpdateMessage extends WebSocketMessage {
  type: 'agenda_update';
  data: {
    agenda: MeetingAgenda;
    session_id: string;
  };
}
```

## 🔄 Interview Flow

### 1. Start Interview
```typescript
const handleStartInterview = async (interviewSessionId: string) => {
  try {
    // Start interview via API
    const response = await interviewApi.startInterview({ interviewSessionId });

    // Connect to WebSocket for real-time updates
    await wsService.connect(response.sessionId);

    // Listen for real-time events
    wsService.on('transcript_update', handleTranscriptUpdate);
    wsService.on('agenda_update', handleAgendaUpdate);
    wsService.on('interview_complete', handleInterviewComplete);

  } catch (error) {
    console.error('Failed to start interview:', error);
  }
};
```

### 2. Real-time Updates
```typescript
const handleTranscriptUpdate = (data: TranscriptUpdateMessage) => {
  setTranscript(data.data.transcript);
};

const handleAgendaUpdate = (data: AgendaUpdateMessage) => {
  setAgenda(data.data.agenda);
};
```

### 3. Finalize Interview
```typescript
const handleFinalizeInterview = async () => {
  try {
    const result = await interviewApi.finalizeInterview({
      interviewId: sessionId,
      transcript: currentTranscript,
    });

    // Show success message
    console.log('Interview finalized:', result);

  } catch (error) {
    console.error('Failed to finalize interview:', error);
  }
};
```

## 🚨 Error Handling

### Error Boundary Component
```tsx
// src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { Alert, AlertTitle, Button } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Interview component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error" style={{ margin: 20 }}>
          <AlertTitle>Interview Error</AlertTitle>
          Something went wrong with the interview session.
          <br />
          <Button
            color="inherit"
            size="small"
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{ marginTop: 8 }}
          >
            Try Again
          </Button>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### API Error Handling
```typescript
// src/hooks/useApi.ts
import { useState, useCallback } from 'react';

export const useApi = <T,>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (apiCall: () => Promise<T>) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, execute, reset };
};
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Environment Variables for Production
```env
REACT_APP_API_BASE_URL=https://your-api-domain.com
REACT_APP_WS_URL=wss://your-api-domain.com
REACT_APP_MAX_RETRY_ATTEMPTS=5
REACT_APP_CONNECTION_TIMEOUT=10000
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Material-UI Documentation](https://mui.com/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

