# AI Interview System Environment Configuration

## Required Environment Variables

### VITE_PYTHON1_API_URL
The base URL for the AI Interview Python backend service.

**Default:** `http://localhost:8008`

**Examples:**
```bash
# Development
VITE_PYTHON1_API_URL=http://localhost:8008

# Production with path
VITE_PYTHON1_API_URL=https://api.example.com/interview-service

# Staging
VITE_PYTHON1_API_URL=https://staging-api.example.com
```

**Important Notes:**
- This URL is used for both HTTP API calls and WebSocket connections
- The WebSocket URL is automatically constructed by replacing `http://` with `ws://` and `https://` with `wss://`
- Paths are preserved (e.g., `/interview-service` becomes `/interview-service/ws/interview/{sessionId}`)
- CORS must be configured on the backend to allow your frontend domain

## Backend API Endpoints

The Python backend must implement these endpoints:

### 1. Start Interview Session
```
POST {VITE_PYTHON1_API_URL}/start-database-interview
Content-Type: application/json

Request Body:
{
  "interview_id": "uuid-string"
}

Response:
{
  "session_id": "websocket-session-uuid",
  "message": "Session created successfully"
}
```

### 2. Finalize Interview
```
POST {VITE_PYTHON1_API_URL}/finalize-interview
Content-Type: application/json

Request Body:
{
  "interviewId": "uuid-string",
  "transcript": [
    {
      "type": "message_type",
      "timestamp": "2024-01-01T12:00:00Z",
      "data": "message_data"
    }
  ]
}

Response:
{
  "success": true,
  "message": "Interview finalized successfully",
  "analysis": { ... }
}
```

### 3. Health Check (Optional)
```
GET {VITE_PYTHON1_API_URL}/health

Response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 4. WebSocket Connection
```
WebSocket: {VITE_PYTHON1_API_URL_AS_WS}/ws/interview/{session_id}

Messages:
- Client -> Server: {"type": "audio", "audio": "base64-pcm16-data"}
- Client -> Server: {"type": "ping", "ts": 1234567890}
- Server -> Client: {"type": "pong"}
- Server -> Client: {"type": "response.audio.delta", "delta": "base64-pcm16-data"}
- Server -> Client: {"type": "response.done"}
- Server -> Client: {"type": "input_audio_buffer.speech_started"}
```

## CORS Configuration

Your Python backend must allow CORS from your frontend domain:

```python
# FastAPI example
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yourdomain.com"],  # Your frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

## Audio Format

- **Sample Rate:** 24kHz
- **Channels:** 1 (mono)
- **Format:** PCM16 (16-bit signed integers)
- **Encoding:** Little-endian
- **Transport:** Base64-encoded binary data

## Development Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Set your environment variables:
```bash
# .env.local
VITE_PYTHON1_API_URL=http://localhost:8008
```

3. Ensure your Python backend is running on the specified URL

4. Test the connection:
   - Frontend should show "Connected" status when WebSocket connects
   - Audio should flow bidirectionally
   - Interview should save to Supabase `interview_sessions` table

## Troubleshooting

### "Disconnected" immediately after connecting
- Check CORS configuration on backend
- Verify `VITE_PYTHON1_API_URL` is accessible from browser
- Check browser console for WebSocket errors
- Ensure backend handles ping/pong messages

### No audio playback
- Verify user has clicked "Start" (required for AudioContext initialization)
- Check browser console for audio decode errors
- Ensure backend sends `response.audio.delta` messages with valid base64 PCM16 data

### No audio recording
- Check microphone permissions in browser
- Verify AudioRecorder starts successfully
- Check WebSocket connection for outgoing audio messages

### Database errors
- Verify Supabase connection in browser dev tools
- Check that `interview_sessions` table exists and has correct schema
- Ensure user has proper RLS permissions for interview tables