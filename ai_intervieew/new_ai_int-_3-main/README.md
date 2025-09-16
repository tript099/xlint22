# 🎯 AI Interview Server

A comprehensive FastAPI-based interview system with real-time audio/video capabilities, live transcription, and AI-powered analysis using OpenAI's Real-time API.

## 🚀 Features

- **Live Audio Interviews** - Real-time audio communication with OpenAI GPT-4o
- **AI Interview Supervisor** - Intelligent monitoring and autonomous interview management
- **Real-time Transcription** - Automatic speech-to-text with database storage every 10 seconds
- **Database Integration** - Complete interview management system with PostgreSQL
- **Resume Processing** - PDF/DOCX text extraction from S3 storage
- **AI Analysis** - Comprehensive interview evaluation and scoring with ProxyLLM Azure GPT-4.1
- **WebSocket Support** - Low-latency real-time communication
- **Browser Compatibility** - Chrome, Firefox, Edge support with fallback options
- **Live Transcript Storage** - JSONB format with GIN indexing for fast queries
- **Auto-End Interviews** - Automatically finalize interviews when clients disconnect
- **Interview by ID** - Start interviews directly using database interview schedule ID

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [AI Interview Supervisor](#ai-interview-supervisor)
4. [Interview Modes](#interview-modes)
5. [API Endpoints](#api-endpoints)
6. [WebSocket Protocol](#websocket-protocol)
7. [Database Schema](#database-schema)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

## 🏃 Quick Start

### 1. Clone and Setup
```bash
git clone <repository>
cd new_ai_int
chmod +x start_server.sh
./start_server.sh
```

### 2. Access the Application
- **Main Server**: http://localhost:8000
- **Test Client**: http://localhost:8000/client
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## 🔧 Environment Setup

### Required Environment Variables
Create a `.env` file in the project root:

```bash
# OpenAI Configuration (REQUIRED for real-time interviews)
OPENAI_API_KEY=sk-proj-your-openai-api-key

# ProxyLLM Configuration (for AI analysis)
PROXYLLM_URL=https://proxyllm.ximplify.id/v1/chat/completions
PROXYLLM_KEY=sk-CxXh7gykTHvf9Vvi3x9Ehg
PROXYLLM_MODEL=azure/gpt-4.1

# Database Configuration (Required for database interviews)
DB_HOST=your-database-host
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASS=your-database-password
DB_PORT=5432

# S3 Configuration (Required for resume processing)
S3_ENDPOINT_URL=your-s3-endpoint
S3_ACCESS_KEY=your-s3-access-key
S3_SECRET_KEY=your-s3-secret-key
S3_BUCKET_NAME=your-bucket-name
S3_REGION=your-region
```

### Dependencies Installation
```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## 🧠 AI Interview Supervisor

The AI Interview Supervisor is an intelligent monitoring system that runs alongside live interviews, ensuring optimal quality and efficiency.

### **Key Features**
- **30-Second Analysis Cycles**: Continuous monitoring of conversation flow
- **Autonomous Actions**: Automatic guidance, conclusion, and termination
- **Quality Metrics**: Topic relevance, question quality, interview progress tracking
- **Smart Interventions**: Natural redirection when conversations go off-topic

### **Supervisor Actions**
1. **IGNORE**: Continue monitoring (all metrics healthy)
2. **GUIDE**: Send redirection messages to interviewer
3. **CONCLUDE**: Signal to start wrapping up the interview  
4. **END**: Automatically terminate the interview

### **Configuration**
```bash
# Supervisor settings (optional)
SUPERVISOR_ANALYSIS_INTERVAL=30    # Analysis frequency in seconds
SUPERVISOR_MAX_DURATION=35         # Maximum interview duration in minutes
SUPERVISOR_CONCLUSION_TIME=25      # When to start concluding in minutes
```

For detailed information, see [AI_INTERVIEW_SUPERVISOR.md](AI_INTERVIEW_SUPERVISOR.md)

## 🎪 Interview Modes

The system supports two interview modes:

### 1. Manual Interview Setup
- Directly input job description and resume text
- Quick testing and standalone interviews
- No database dependency required

### 2. Database Interview by ID
- Use existing interview schedule from database
- Automatic job description and resume retrieval
- Live transcription storage and management
- Proper interview lifecycle tracking

## 🌐 Using the Web Client

### Access the Client
Navigate to `http://localhost:8000/client` in your browser.

### Browser Requirements
- **Recommended**: Chrome, Firefox, or Edge
- **Audio Support**: Requires HTTPS or localhost access
- **Microphone**: Allow microphone permissions when prompted
- **Headphones**: Recommended to prevent audio feedback

### Starting a Manual Interview
1. Click on the **"Manual Interview Setup"** tab
2. Enter job description in the textarea
3. Enter resume text in the textarea
4. Enter candidate name
5. Click **"Start Interview"**
6. Click **"Connect to Interview"**
7. Enable audio and start speaking

### Starting a Database Interview
1. Click on the **"Database Interview (by ID)"** tab
2. Enter the interview schedule ID from your database
3. Click **"Start Database Interview"**
4. Click **"Connect to Interview"**
5. Optionally view live transcript during the interview
6. Enable audio and start speaking

## 📡 API Endpoints

### Interview Management

#### Start Manual Interview
```http
POST /start-interview
Content-Type: application/json

{
  "job_description": "Software Engineer position...",
  "resume_text": "John Doe - Software Developer...",
  "candidate_name": "John Doe"
}

Response:
{
  "session_id": "uuid",
  "message": "Interview session created successfully",
  "websocket_url": "/ws/interview/{session_id}"
}
```

#### Start Database Interview
```http
POST /start-database-interview
Content-Type: application/json

{
  "interview_id": "interview-schedule-uuid"
}

Response:
{
  "session_id": "uuid",
  "interview_id": "interview-schedule-uuid",
  "candidate_name": "John Doe",
  "message": "Database interview session created with live transcription",
  "websocket_url": "/ws/interview/{session_id}"
}
```

#### End Interview Manually
```http
DELETE /session/{session_id}/end

Response:
{
  "message": "Interview ended and finalized successfully",
  "interview_summary": {
    "session_id": "uuid",
    "candidate_name": "John Doe",
    "conversation_length": 15,
    "transcript_entries": 45,
    "status": "completed"
  }
}
```

### Live Transcription

#### Get Live Transcript (Active Session)
```http
GET /session/{session_id}/transcript

Response:
{
  "session_id": "uuid",
  "live_transcript": [...],
  "summary": {
    "total_entries": 45,
    "user_speech_count": 12,
    "ai_response_count": 8,
    "interview_duration_minutes": 25.5
  }
}
```

#### Get Live Transcript (Database)
```http
GET /interview/{interview_id}/live-transcript

Response:
{
  "interview_id": "interview-schedule-uuid",
  "live_transcript": [...],
  "status": "in_progress",
  "started_at": "2025-09-04T10:30:00Z"
}
```

### AI Analysis

#### Prepare Interview Context
```http
POST /prepare-interview-context
Content-Type: application/json

{
  "interviewId": "interview-schedule-uuid"
}
```

#### Finalize Interview with AI Analysis
```http
POST /finalize-interview
Content-Type: application/json

{
  "interviewId": "interview-schedule-uuid",
  "transcript": [...]
}
```

#### Get Interview Report
```http
POST /get-interview-report
Content-Type: application/json

{
  "interviewId": "interview-schedule-uuid"
}
```

### AI Supervisor Management

#### Get Supervisor Status
```http
GET /session/{session_id}/supervisor

Response:
{
  "session_id": "uuid",
  "supervisor_stats": {
    "is_active": true,
    "analysis_count": 12,
    "actions_taken": 3,
    "conclusion_initiated": false,
    "elapsed_minutes": 18.5
  }
}
```

#### Manual Supervisor Action
```http
POST /session/{session_id}/supervisor/action
Content-Type: application/json

{
  "action": "guide|conclude|end",
  "message": "Custom guidance message"
}
```

## 🔌 WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/interview/{session_id}');
```

### Message Types

#### Send Audio Data
```json
{
  "type": "audio",
  "audio": "base64-encoded-pcm16-data"
}
```

#### End Audio Input
```json
{
  "type": "audio_end"
}
```

#### Send Text Message
```json
{
  "type": "text",
  "content": "Hello, this is a text message"
}
```

#### Received Messages
- `response.audio.delta` - Audio response chunks
- `response.text.done` - Complete AI text response
- `input_audio_buffer.speech_started` - User started speaking
- `input_audio_buffer.speech_stopped` - User stopped speaking
- `conversation.item.input_audio_transcription.completed` - User speech transcribed

## 🗄️ Database Schema

### Key Tables

#### interview_schedules
```sql
CREATE TABLE interview_schedules (
  id uuid PRIMARY KEY,
  job_application_id uuid REFERENCES job_applications(id),
  status text DEFAULT 'scheduled',
  scheduled_at timestamp,
  started_at timestamp,
  ended_at timestamp,
  conversation_log jsonb DEFAULT '[]',
  live_transcript jsonb DEFAULT '[]',
  final_ai_review text,
  ai_review jsonb,
  final_ai_evaluation_score numeric
);
```

#### Live Transcript Format
```json
[
  {
    "timestamp": "2025-09-04T10:30:45.123456",
    "speaker": "user|assistant|system",
    "content": "Transcribed text content",
    "type": "text|audio|system",
    "session_id": "uuid"
  }
]
```

## 🧪 Testing

### Run the Test Client
```bash
# Start the server
./start_server.sh

# In another terminal, run the test client
python test_client.py
```

### Test with Docker
```bash
# Build and run with Docker
./test_docker.sh

# Or manually
docker build -t ai-interview-server .
docker run -p 8000:8000 --env-file .env ai-interview-server
```

### Browser Testing
1. Open `http://localhost:8000/client`
2. Test both manual and database interview modes
3. Try both audio and text communication
4. Test disconnection and auto-end functionality

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t ai-interview-server .

# Run container
docker run -d \
  --name ai-interview \
  -p 8000:8000 \
  --env-file .env \
  ai-interview-server
```

### Production Environment Variables
```bash
# Production overrides
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=warning

# Security
ALLOWED_ORIGINS=https://yourdomain.com
JWT_SECRET_KEY=your-secret-key

# Database connection pooling
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
```

## 🔧 Troubleshooting

### Common Issues

#### Audio Not Working
- **Solution**: Use Chrome/Firefox with HTTPS or localhost
- **Check**: Microphone permissions granted
- **Try**: Refresh page and allow microphone access

#### Database Connection Failed
- **Check**: Database credentials in `.env`
- **Verify**: Database server is running and accessible
- **Test**: Connection string and firewall settings

#### OpenAI API Errors
- **Verify**: `OPENAI_API_KEY` is valid and has sufficient credits
- **Check**: API rate limits and usage quotas
- **Monitor**: OpenAI service status

#### WebSocket Connection Issues
- **Solution**: Check firewall and proxy settings
- **Try**: Different network or disable VPN
- **Verify**: Server is running on correct port

### Audio Setup Issues

#### Browser Compatibility
```javascript
// Check browser support
if (!navigator.mediaDevices?.getUserMedia) {
  console.error('Browser does not support audio recording');
}
```

#### HTTPS Requirements
- **Development**: Use `localhost:8000` (not `127.0.0.1`)
- **Production**: Must use HTTPS for microphone access
- **Testing**: Chrome allows localhost without HTTPS

### Performance Optimization

#### Database Indexing
```sql
-- Add indexes for better performance
CREATE INDEX idx_interview_schedules_status ON interview_schedules(status);
CREATE INDEX idx_interview_schedules_started_at ON interview_schedules(started_at);
CREATE INDEX idx_live_transcript_gin ON interview_schedules USING gin(live_transcript);
```

#### Connection Pooling
```python
# Increase pool size for high load
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=100
```

## 📚 Advanced Features

### Custom Interview Instructions
Modify the interview prompt in `realtime_interview.py`:
```python
def create_interview_prompt(self) -> str:
    return f"""
    You are conducting a {self.interview_type} interview.
    Focus on {self.focus_areas}.
    Interview duration: {self.duration_minutes} minutes.
    """
```

### Webhook Integration
Add webhook notifications for interview events:
```python
@app.post("/webhook/interview-completed")
async def interview_completed_webhook(data: dict):
    # Send notification to external system
    pass
```

### Custom AI Models
Switch between different OpenAI models:
```python
# In realtime_interview.py
"model": "gpt-4o-realtime-preview-2024-10-01"  # Default
"model": "gpt-4o-mini-realtime-preview"        # Faster, cheaper
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation at `/docs`
3. Check server logs for error details
4. Open an issue on GitHub

## 🔮 Roadmap

- [ ] Multi-interviewer support
- [ ] Video interview capabilities
- [ ] Interview scheduling interface
- [ ] Advanced analytics dashboard
- [ ] Mobile app support
- [ ] Integration with ATS systems
- [ ] Custom scoring algorithms
- [ ] Interview recording playback
