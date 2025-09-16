from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import json
import asyncio
import logging
import os
import traceback
import requests
from typing import Optional, Tuple, Dict, Any
from io import BytesIO
from dotenv import load_dotenv
import uuid
from datetime import datetime
from realtime_interview import InterviewManager
from azure_realtime_handler import AzureInterviewManager
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import pypdf
import docx
from tenacity import retry, stop_after_attempt, wait_fixed
from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

# Initialize Supabase client globally with service role key
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lmzzskcneufwglycfdov.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtenpza2NuZXVmd2dseWNmZG92Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE4NTMwOSwiZXhwIjoyMDcxNzYxMzA5fQ.KiVUhOCJeffWVydsYIJkgvSSPZQVajMgZCfBP4ZHkOg")

# Global Supabase client for all database operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- SETTINGS AND DATABASE CONFIGURATION ---
class Settings:
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://lmzzskcneufwglycfdov.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "sb_publishable_RcFtEqS2LPwTtPfd2EU2RA_uX0Vzt0f")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")  # Service role key to bypass RLS
    
    # Database Configuration (fallback - not used with Supabase)
    DB_HOST: str = os.getenv("DB_HOST", "aws-0-ap-south-1.pooler.supabase.com")
    DB_NAME: str = os.getenv("DB_NAME", "postgres")
    DB_USER: str = os.getenv("DB_USER", "postgres.lmzzskcneufwglycfdov")
    DB_PASS: str = os.getenv("DB_PASS", "Chaosop01@")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    
    # S3 Configuration
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "https://wtwhyndtvxecpsyrpvll.supabase.co")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "00f1d4346807bb42f59c466296077afc")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "d0c68aaf603b8b75588f45c2d3e4e5127a2a19a3c797915d4b7b3324329c239e")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "resumes")
    S3_REGION: str = os.getenv("S3_REGION", "ap-south-1")
    
    # OpenAI Configuration (for real-time API)
    OPENAI_KEY: str = os.environ.get("OPENAI_API_KEY") or "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"
    
    # Azure OpenAI Configuration (alternative to OpenAI)
    USE_AZURE_OPENAI: bool = os.getenv("USE_AZURE_OPENAI", "false").lower() == "true"
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_DEPLOYMENT_NAME: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2025-04-01-preview")
    
    # ProxyLLM Configuration (for AI analysis)
    PROXYLLM_URL: str = os.getenv("PROXYLLM_URL", "https://proxyllm.ximplify.id/v1/chat/completions")
    PROXYLLM_KEY: str = os.getenv("PROXYLLM_KEY", "sk-CxXh7gykTHvf9Vvi3x9Ehg")
    PROXYLLM_MODEL: str = os.getenv("PROXYLLM_MODEL", "azure/gpt-4.1")

settings = Settings()

# --- DATABASE AND S3 UTILITY FUNCTIONS ---
def get_supabase_client() -> Client:
    """Get Supabase client for database operations"""
    try:
        # Use service role key if available (bypasses RLS), otherwise use public key
        key = settings.SUPABASE_SERVICE_KEY if settings.SUPABASE_SERVICE_KEY else settings.SUPABASE_KEY
        key_type = "service_role" if settings.SUPABASE_SERVICE_KEY else "public"
        print(f"Using Supabase {key_type} key: {key[:20]}...")
        return create_client(settings.SUPABASE_URL, key)
    except Exception as e:
        logging.error(f"Supabase client creation failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def get_db_connection():
    """Get direct PostgreSQL database connection (DEPRECATED - use get_supabase_client)"""
    try:
        return psycopg2.connect(
            host=settings.DB_HOST,
            database=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASS,
            port=settings.DB_PORT,
            cursor_factory=RealDictCursor
        )
    except psycopg2.OperationalError as e:
        logging.error(f"Database connection failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def get_s3_client():
    """Get S3 client for direct bucket access"""
    return boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}
        )
    )

def parse_s3_key_from_url(url: str, bucket_name: str) -> Optional[str]:
    """Parse S3 object key from Supabase storage URL"""
    patterns = [
        f"/storage/v1/object/public/{bucket_name}/",
        f"/object/public/{bucket_name}/",
        f"/{bucket_name}/"
    ]
    
    for pattern in patterns:
        if pattern in url:
            key = url.split(pattern, 1)[1]
            logging.debug(f"Extracted S3 key: {key} from URL: {url}")
            return key
    
    logging.error(f"Could not parse S3 key from URL: {url}")
    return None

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def download_resume_from_s3(url: str) -> Tuple[bytes, str]:
    """Download resume file from S3 storage"""
    object_key = parse_s3_key_from_url(url, settings.S3_BUCKET_NAME)
    if not object_key:
        raise ValueError(f"Invalid resume URL format: {url}")
    
    try:
        # Try direct HTTP download first (for Supabase storage URLs)
        if url.startswith("https://") and "supabase.co" in url:
            logging.debug(f"Using direct HTTP download for URL: {url}")
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            content_type = response.headers.get('content-type', '')
            return response.content, content_type
        
        # Fallback to S3 client
        s3_client = get_s3_client()
        logging.debug(f"Downloading from S3 - Bucket: {settings.S3_BUCKET_NAME}, Key: {object_key}")
        s3_object = s3_client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
        return s3_object['Body'].read(), s3_object.get('ContentType', '')
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logging.error(f"S3 ClientError downloading {object_key}: {error_code}")
        raise
    except Exception as e:
        logging.error(f"Unexpected error downloading {object_key}: {str(e)}")
        raise

def extract_text_from_resume(file_content: bytes, content_type: str) -> Optional[str]:
    """Extract text from PDF or Word resume files"""
    try:
        if 'pdf' in content_type:
            with BytesIO(file_content) as f:
                return "".join(p.extract_text() for p in pypdf.PdfReader(f).pages if p.extract_text())
        elif 'word' in content_type:
            with BytesIO(file_content) as f:
                return "\n".join(p.text for p in docx.Document(f).paragraphs)
    except Exception as e:
        raise IOError(f"Failed to extract text from resume: {e}") from e

# --- APP SETUP ---
app_state = {}
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("FastAPI app starting up...")
    
    # Validate required environment variables
    required_envs = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_KEY", 
        "AZURE_OPENAI_DEPLOYMENT_NAME",
        "AZURE_OPENAI_API_VERSION"
    ]
    
    missing_envs = []
    for env_var in required_envs:
        value = os.getenv(env_var)
        if not value:
            missing_envs.append(env_var)
    
    if missing_envs:
        error_msg = f"❌ Missing required environment variables: {', '.join(missing_envs)}"
        print(error_msg)
        raise RuntimeError(error_msg)
    
    # Log configuration
    print(f"✅ Environment validation passed")
    print(f"✅ Supabase URL: {settings.SUPABASE_URL}")
    print(f"✅ Service key configured: {settings.SUPABASE_SERVICE_KEY[:20]}...")
    
    # Show AI provider configuration
    if settings.USE_AZURE_OPENAI:
        # Normalize Azure endpoint
        azure_endpoint = settings.AZURE_OPENAI_ENDPOINT.rstrip('/')
        azure_host = azure_endpoint.replace('https://', '').replace('http://', '')
        
        # Build WebSocket URL for logging
        ws_url = f"wss://{azure_host}/openai/realtime?api-version={settings.AZURE_OPENAI_API_VERSION}&deployment={settings.AZURE_OPENAI_DEPLOYMENT_NAME}"
        
        print(f"✅ Using Azure OpenAI - Endpoint: {azure_endpoint}")
        print(f"✅ Azure Deployment: {settings.AZURE_OPENAI_DEPLOYMENT_NAME}")
        print(f"✅ Azure API Version: {settings.AZURE_OPENAI_API_VERSION}")
        print(f"✅ Azure WebSocket URL: {ws_url}")
        print(f"✅ API Key configured: {settings.AZURE_OPENAI_API_KEY[:10]}...")
        
        # Validate API version for realtime
        if "preview" not in settings.AZURE_OPENAI_API_VERSION:
            print(f"⚠️  Warning: API version {settings.AZURE_OPENAI_API_VERSION} may not support realtime features")
    else:
        print("✅ Using OpenAI Real-time API")
        print(f"✅ OpenAI Key configured: {settings.OPENAI_KEY[:10]}...")
    
    # Test database connection
    try:
        supabase = get_supabase_client()
        # Test connection by trying to fetch from a table
        response = supabase.table('interview_sessions').select('id').limit(1).execute()
        print("✅ Supabase connection successful.")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        
    yield
    print("FastAPI app shutting down...")

app = FastAPI(title="AI Interview Server", version="1.0.0", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Debug endpoint to check database data
@app.get("/debug/interview-sessions")
async def debug_interview_sessions():
    try:
        supabase = get_supabase_client()
        
        # Get all interview sessions
        sessions_response = supabase.table('interview_sessions').select('*').execute()
        
        # Get all employees  
        employees_response = supabase.table('xlsmart_employees').select('id, first_name, last_name').execute()
        
        return {
            "interview_sessions": sessions_response.data,
            "employees": employees_response.data,
            "session_count": len(sessions_response.data) if sessions_response.data else 0,
            "employee_count": len(employees_response.data) if employees_response.data else 0
        }
    except Exception as e:
        return {"error": str(e)}

# Debug endpoint to check all employee-related data
@app.get("/debug/employee-tables")
async def debug_employee_tables():
    try:
        supabase = get_supabase_client()
        
        # Check multiple possible employee tables
        tables_to_check = [
            'xlsmart_employees',
            'employees', 
            'employee',
            'users',
            'profiles'
        ]
        
        results = {}
        for table in tables_to_check:
            try:
                response = supabase.table(table).select('*').limit(5).execute()
                results[table] = {
                    "exists": True,
                    "count": len(response.data) if response.data else 0,
                    "sample_data": response.data[:2] if response.data else []
                }
            except Exception as e:
                results[table] = {
                    "exists": False,
                    "error": str(e)
                }
        
        return results
    except Exception as e:
        return {"error": str(e)}

# Pydantic models
class InterviewRequest(BaseModel):
    job_description: str
    resume_text: str
    candidate_name: Optional[str] = "Candidate"

class DatabaseInterviewRequest(BaseModel):
    interview_id: str  # Database interview schedule ID
    
class PrepareRequest(BaseModel):
    interviewId: str

class FinalizeRequest(BaseModel):
    interviewId: str
    transcript: list  # Expects a list of message objects

class ReportRequest(BaseModel):
    interviewId: str

# Store active interview sessions
active_sessions = {}

# Validate AI configuration
if settings.USE_AZURE_OPENAI:
    if not all([settings.AZURE_OPENAI_ENDPOINT, settings.AZURE_OPENAI_API_KEY, settings.AZURE_OPENAI_DEPLOYMENT_NAME]):
        raise ValueError("Azure OpenAI configuration is incomplete. Please check AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT_NAME")
    logger.info("Using Azure OpenAI for real-time interviews")
else:
    OPENAI_API_KEY = settings.OPENAI_KEY
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is required when not using Azure")
    logger.info("Using OpenAI for real-time interviews")

@app.get("/")
async def root():
    return {"message": "AI Interview Server is running"}

@app.get("/health")
async def health_check():
    """Enhanced health check with session monitoring"""
    active_count = len(active_sessions)
    ai_connections = 0
    expired_connections = 0
    
    for session_id, manager in active_sessions.items():
        if manager.audio_handler and manager.audio_handler.is_connected:
            ai_connections += 1
            if manager.audio_handler.is_connection_expired():
                expired_connections += 1
    
    return {
        "status": "healthy", 
        "service": "AI Interview Server",
        "ai_provider": "Azure OpenAI" if settings.USE_AZURE_OPENAI else "OpenAI",
        "active_sessions": active_count,
        "ai_connections": ai_connections,
        "expired_connections": expired_connections,
        "billing_alert": expired_connections > 0
    }

@app.post("/start-interview")
async def start_interview(request: InterviewRequest):
    """
    Initialize an interview session with job description and resume
    """
    try:
        # Generate a unique session ID
        session_id = str(uuid.uuid4())
        
        # Create interview manager based on configuration
        if settings.USE_AZURE_OPENAI:
            interview_manager = AzureInterviewManager(
                session_id=session_id,
                job_description=request.job_description,
                resume_text=request.resume_text,
                candidate_name=request.candidate_name,
                interview_duration=30  # Default 30 minutes for non-database interviews
            )
        else:
            interview_manager = InterviewManager(
                session_id=session_id,
                job_description=request.job_description,
                resume_text=request.resume_text,
                candidate_name=request.candidate_name
            )
        
        # Store session
        active_sessions[session_id] = interview_manager
        
        logger.info(f"Created interview session: {session_id} (using {'Azure' if settings.USE_AZURE_OPENAI else 'OpenAI'})")
        
        return {
            "session_id": session_id,
            "message": "Interview session created successfully",
            "websocket_url": f"/ws/interview/{session_id}"
        }
        
    except Exception as e:
        logger.error(f"Error creating interview session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start-database-interview")
async def start_database_interview(request: DatabaseInterviewRequest):
    """
    Start an interview session using database interview schedule with live transcription
    """
    try:
        logger.info(f"🚀 Starting database interview for ID: {request.interview_id}")
        
        # Get interview session details with employee and job description data
        interview_response = supabase.table('interview_sessions').select(
            '''
            *,
            employee_id,
            job_description_id
            '''
        ).eq('id', request.interview_id).execute()
        
        if not interview_response.data or len(interview_response.data) == 0:
            raise HTTPException(status_code=404, detail="Interview session not found")
            
        interview_data = interview_response.data[0]
        logger.info(f"✅ Interview data retrieved: {interview_data['id']}")
        
        # Get employee data separately
        employee_response = supabase.table('xlsmart_employees').select(
            '''
            id,
            first_name,
            last_name,
            email,
            current_position,
            current_department,
            skills,
            years_of_experience
            '''
        ).eq('id', interview_data['employee_id']).execute()
        
        logger.info(f"✅ Employee data retrieved for ID {interview_data['employee_id']}")
        
        # Get job description data separately  
        job_response = supabase.table('xlsmart_job_descriptions').select(
            '''
            id,
            title,
            summary,
            required_skills,
            experience_level,
            responsibilities,
            required_qualifications
            '''
        ).eq('id', interview_data['job_description_id']).execute()
        
        if not employee_response.data or len(employee_response.data) == 0:
            raise HTTPException(status_code=404, detail="Employee data not found for interview session")
        if not job_response.data or len(job_response.data) == 0:
            raise HTTPException(status_code=404, detail="Job description data not found for interview session")
            
        employee_data = employee_response.data[0]
        job_data = job_response.data[0]
        
        # Extract data for the interview
        job_description = job_data.get('summary') or "No job description provided."
        job_title = job_data.get('title') or "Position"
        candidate_name = f"{employee_data.get('first_name', '')} {employee_data.get('last_name', '')}"
        interview_duration = interview_data.get('duration_minutes', 30)  # Default to 30 minutes
        
        # Prepare employee profile as "resume text"
        employee_profile = f"""
        Name: {candidate_name}
        Current Role: {employee_data.get('current_position', 'Not specified')}
        Department: {employee_data.get('current_department', 'Not specified')}
        Experience Level: {employee_data.get('years_of_experience', 'Not specified')} years
        Skills: {', '.join(employee_data.get('skills', [])) if employee_data.get('skills') else 'Not specified'}
        """
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Create interview manager with database ID based on configuration
        if settings.USE_AZURE_OPENAI:
            interview_manager = AzureInterviewManager(
                session_id=session_id,
                job_description=job_description,
                resume_text=employee_profile,
                candidate_name=candidate_name,
                interview_id=request.interview_id,
                interview_duration=interview_duration
            )
        else:
            interview_manager = InterviewManager(
                session_id=session_id,
                job_description=job_description,
                resume_text=employee_profile,
                candidate_name=candidate_name,
                interview_id=request.interview_id
            )
        
        # Update interview session status to 'in_progress' using Supabase
        update_response = supabase.table('interview_sessions').update({
            'status': 'in_progress',
            'started_at': datetime.now().isoformat()
        }).eq('id', request.interview_id).execute()
        
        # Store session
        active_sessions[session_id] = interview_manager
        
        logger.info(f"Created XLSMART interview session: {session_id} for interview ID: {request.interview_id}")
        
        return {
            "session_id": session_id,
            "interview_id": request.interview_id,
            "candidate_name": candidate_name,
            "job_title": job_title,
            "message": "XLSMART interview session created with live transcription",
            "websocket_url": f"/ws/interview/{session_id}"
        }
            
    except Exception as e:
        logger.error(f"Error creating XLSMART interview session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/interview/{session_id}")
async def websocket_interview_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time interview audio communication
    """
    await websocket.accept()
    
    # Get interview manager
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        await websocket.close(code=4004, reason="Session not found")
        return
        
    interview_manager.client_websocket = websocket
    
    logger.info(f"✅ WebSocket connected for session: {session_id}")
    
    # Initialize variables for cleanup
    openai_task = None
    azure_connected = False
    
    try:
        # Initialize audio handler (Azure or OpenAI)
        try:
            if settings.USE_AZURE_OPENAI:
                azure_connected = await interview_manager.initialize_audio_handler()
            else:
                azure_connected = await interview_manager.initialize_audio_handler(OPENAI_API_KEY)
        except Exception as init_error:
            logger.error(f"❌ Error during audio handler initialization: {init_error}")
            logger.error(f"Error type: {type(init_error).__name__}")
            azure_connected = False
            
        if not azure_connected:
            # Don't end the session immediately - send error to client and keep session alive
            error_msg = f"Failed to connect to {'Azure' if settings.USE_AZURE_OPENAI else 'OpenAI'} Realtime API"
            logger.error(f"❌ {error_msg}")
            
            # Send error event to client instead of closing WebSocket
            await websocket.send_text(json.dumps({
                "type": "error",
                "code": "azure_connect_failed",
                "message": error_msg
            }))
            
            # Keep the WebSocket open for retry or graceful end
            logger.info(f"Keeping session {session_id} alive despite Azure connection failure")
        else:
            # Start listening for responses in background only if connected
            openai_task = asyncio.create_task(
                interview_manager.audio_handler.listen_for_responses(
                    interview_manager.handle_openai_message
                )
            )
            
            # Start the interview only if Azure connected
            await interview_manager.start_interview()
        
        # Handle client messages (including ping/pong)
        try:
            async for message in websocket.iter_text():
                data = json.loads(message)
                message_type = data.get("type")
                
                if message_type == "ping":
                    # Respond to heartbeat ping
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "ts": data.get("ts", None)
                    }))
                    continue
                
                # Only process audio/interview messages if Azure is connected
                if not azure_connected:
                    logger.warning(f"Ignoring {message_type} message - Azure not connected")
                    continue
                
                if message_type == "audio":
                    # Handle audio data
                    await interview_manager.handle_client_audio(data.get("audio", ""))
                    
                elif message_type == "audio_test":
                    # Handle audio test data with enhanced logging
                    audio_data = data.get("audio", "")
                    timestamp = data.get("timestamp", "")
                    logger.info(f"🧪 Audio test received: {len(audio_data)} base64 chars at {timestamp}")
                    
                    # Process test audio (same as regular audio but with test logging)
                    if audio_data:
                        await interview_manager.handle_client_audio(audio_data)
                        
                        # Send test confirmation back to client
                        await websocket.send_text(json.dumps({
                            "type": "audio_test_result",
                            "status": "success",
                            "message": "Audio test received and processed successfully",
                            "timestamp": timestamp,
                            "size": len(audio_data)
                        }))
                        logger.info("✅ Audio test processed successfully, confirmation sent to client")
                    
                elif message_type == "audio_end":
                    # Commit audio and request response
                    await interview_manager.commit_audio_and_respond()
                    
                elif message_type == "text":
                    # Handle text message
                    text_content = data.get("content", "")
                    if text_content:
                        # Add text message to transcript
                        interview_manager.add_to_transcript("user", text_content, "text")
                        
                        # Send to audio handler
                        await interview_manager.audio_handler.send_text_message(text_content, "user")
                        await interview_manager.audio_handler.request_response()
        
        except WebSocketDisconnect:
            logger.info(f"Client disconnected from session: {session_id}")
            # Auto-end interview on disconnect if Azure was connected
            if interview_manager and azure_connected:
                logger.info(f"Auto-ending interview for session: {session_id}")
                try:
                    # Update database status if this is a database interview
                    if interview_manager.interview_id:
                        try:
                            supabase = get_supabase_client()
                            supabase.table('interview_sessions').update({
                                'status': 'disconnected',
                                'completed_at': datetime.now().isoformat()
                            }).eq('id', interview_manager.interview_id).execute()
                            logger.info(f"Updated interview status to 'disconnected' for interview ID: {interview_manager.interview_id}")
                        except Exception as e:
                            logger.error(f"Error updating interview status on disconnect: {e}")
                except Exception as e:
                    logger.error(f"Error updating interview status on disconnect: {e}")
        
        # Cancel background task
        if openai_task:
            try:
                openai_task.cancel()
                await openai_task
            except asyncio.CancelledError:
                logger.info("Audio handler listening task cancelled successfully")
            except Exception as e:
                logger.error(f"Error cancelling audio handler task: {e}")
        
    except Exception as e:
        logger.error(f"❌ Error in WebSocket communication: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        
        # Only close WebSocket for fatal errors, not for audio handling errors
        if "audio" not in str(e).lower() and azure_connected:
            await websocket.close(code=1011, reason="Internal server error")
        else:
            logger.info("Non-fatal error, keeping WebSocket connection alive")
            # Try to send error message to client instead of closing
            try:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "code": "audio_error",
                    "message": str(e)
                }))
            except Exception as send_error:
                logger.error(f"Failed to send error message to client: {send_error}")
                await websocket.close(code=1011, reason="Internal server error")
    finally:
        # Cleanup and auto-end interview only if Azure was connected
        if interview_manager and azure_connected:
            try:
                await interview_manager.end_interview()
                logger.info(f"Interview properly ended for session: {session_id}")
            except Exception as e:
                logger.error(f"Error ending interview: {e}")
        
        # Only remove session from active_sessions on explicit finalize or fatal error
        # NOT when Azure connection fails - keep it for retry/graceful end
        if session_id in active_sessions:
            # Check if this is an explicit finalize or fatal error
            should_remove = azure_connected  # Only remove if we actually connected
            if should_remove:
                del active_sessions[session_id]
                logger.info(f"Removed session from active sessions: {session_id}")
            else:
                logger.info(f"Keeping session {session_id} in active_sessions for potential retry")

@app.get("/sessions")
async def get_active_sessions():
    """
    Get list of active interview sessions
    """
    sessions_info = []
    for session_id, interview_manager in active_sessions.items():
        sessions_info.append({
            "session_id": session_id,
            "candidate_name": interview_manager.candidate_name,
            "is_active": interview_manager.is_active
        })
    
    return {"active_sessions": sessions_info}

@app.get("/session/{session_id}/transcript")
async def get_live_transcript(session_id: str):
    """
    Get live transcription for an active session
    """
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "live_transcript": interview_manager.get_live_transcript(),
        "summary": interview_manager.get_transcript_summary()
    }

@app.get("/session/{session_id}/agenda")
async def get_meeting_agenda_status(session_id: str):
    """
    Get meeting agenda status and progress for an active session
    """
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if this is an Azure interview manager with agenda support
    if hasattr(interview_manager, 'get_meeting_agenda_status'):
        agenda_status = interview_manager.get_meeting_agenda_status()
        return {
            "session_id": session_id,
            "agenda_status": agenda_status
        }
    else:
        return {
            "session_id": session_id,
            "agenda_status": {
                "status": "not_supported",
                "message": "Meeting agenda is only available for Azure OpenAI interviews"
            }
        }

@app.get("/session/{session_id}/prompt-status")
async def get_prompt_reinforcement_status(session_id: str):
    """
    Get prompt reinforcement system status for debugging
    """
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if this is an Azure interview manager with prompt reinforcement
    if hasattr(interview_manager, 'get_prompt_reinforcement_status'):
        prompt_status = interview_manager.get_prompt_reinforcement_status()
        return {
            "session_id": session_id,
            "prompt_reinforcement_status": prompt_status
        }
    else:
        return {
            "session_id": session_id,
            "prompt_reinforcement_status": {
                "status": "not_supported",
                "message": "Prompt reinforcement is only available for Azure OpenAI interviews"
            }
        }

@app.post("/session/{session_id}/force-prompt-refresh")
async def force_prompt_refresh(session_id: str):
    """
    Force a manual prompt refresh for testing/debugging
    """
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if this is an Azure interview manager with prompt reinforcement
    if hasattr(interview_manager, 'force_prompt_refresh'):
        try:
            await interview_manager.force_prompt_refresh()
            return {
                "session_id": session_id,
                "message": "Manual prompt refresh triggered successfully"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to refresh prompt: {e}")
    else:
        raise HTTPException(status_code=400, detail="Prompt refresh is only available for Azure OpenAI interviews")

@app.get("/session/{session_id}/agenda-context")
async def get_agenda_context(session_id: str):
    """
    Get the current agenda context that would be included in prompt refreshes
    """
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if this is an Azure interview manager with agenda support
    if hasattr(interview_manager, 'audio_handler') and interview_manager.audio_handler:
        audio_handler = interview_manager.audio_handler
        
        if hasattr(audio_handler, '_create_context_enhanced_instructions'):
            try:
                context_instructions = audio_handler._create_context_enhanced_instructions()
                context_aware_instructions = audio_handler._create_context_aware_instructions()
                
                return {
                    "session_id": session_id,
                    "agenda_context": {
                        "full_enhanced_instructions": context_instructions,
                        "response_context_instructions": context_aware_instructions,
                        "has_meeting_agenda": bool(audio_handler.meeting_agenda),
                        "current_topic_index": audio_handler.current_topic_index,
                        "completed_topics_count": len(audio_handler.completed_topics),
                        "total_modules": len(audio_handler.meeting_agenda.get("modules", [])) if audio_handler.meeting_agenda else 0
                    }
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to get agenda context: {e}")
        else:
            return {
                "session_id": session_id,
                "agenda_context": {
                    "status": "not_available",
                    "message": "Agenda context methods not available"
                }
            }
    else:
        raise HTTPException(status_code=400, detail="Agenda context is only available for Azure OpenAI interviews")

@app.get("/interview/{interview_id}/live-transcript")
async def get_database_live_transcript(interview_id: str):
    """
    Get live transcription directly from database
    """
    try:
        response = supabase.table('interview_sessions').select('transcript, status, started_at').eq('id', interview_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        result = response.data[0]
        return {
            "interview_id": interview_id,
            "live_transcript": result.get('transcript', {}),
            "status": result.get('status'),
            "started_at": result.get('started_at')
        }
    except Exception as e:
        logger.error(f"Error fetching interview transcript: {e}")
        raise HTTPException(status_code=500, detail="Error fetching interview data")

@app.delete("/session/{session_id}")
async def end_interview_session(session_id: str):
    """
    End an interview session and update database status
    """
    interview_manager = active_sessions.get(session_id)
    if not interview_manager:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update database status if this is a database interview
    if interview_manager.interview_id:
        try:
            supabase.table('interview_sessions').update({
                'status': 'completed',
                'completed_at': 'now()'
            }).eq('id', interview_manager.interview_id).execute()
            logger.info(f"Updated interview status to 'completed' for interview ID: {interview_manager.interview_id}")
        except Exception as e:
            logger.error(f"Error updating interview status: {e}")
    
    # End the interview
    await interview_manager.end_interview()
    
    # Remove from active sessions
    del active_sessions[session_id]
    #call /finalize-interview if interview_id exists
    if interview_manager.interview_id:
        try:
            async with httpx.AsyncClient() as client:
                # Automatically determine the finalize-interview endpoint URL
                finalize_url = os.getenv("FINALIZE_INTERVIEW_URL")
                if not finalize_url:
                    # Use current host if available, fallback to localhost:8008 (this server)
                    host = os.getenv("HOST_URL", "http://localhost:8008")
                    finalize_url = f"{host}/finalize-interview"
                response = await client.post(
                    finalize_url,
                    json={"interviewId": interview_manager.interview_id, "transcript": interview_manager.transcript}
                )
                if response.status_code == 200:
                    logger.info(f"Finalized interview analysis for interview ID: {interview_manager.interview_id}")
                else:
                    logger.error(f"Failed to finalize interview analysis: {response.text}")
        except Exception as e:
            logger.error(f"Error calling finalize-interview endpoint: {e}")
    
    return {
        "message": f"Session {session_id} ended successfully",
        "interview_id": interview_manager.interview_id if interview_manager.interview_id else None
    }

@app.delete("/cleanup-all-sessions")
async def cleanup_all_sessions():
    """
    Emergency cleanup endpoint to end all active sessions (billing protection)
    """
    cleanup_count = 0
    errors = []
    
    # Create a copy of the keys to avoid modification during iteration
    session_ids = list(active_sessions.keys())
    
    for session_id in session_ids:
        try:
            interview_manager = active_sessions.get(session_id)
            if interview_manager:
                await interview_manager.end_interview()
                del active_sessions[session_id]
                cleanup_count += 1
                logger.info(f"Cleaned up session: {session_id}")
        except Exception as e:
            error_msg = f"Error cleaning up session {session_id}: {e}"
            errors.append(error_msg)
            logger.error(error_msg)
    
    return {
        "message": f"Cleaned up {cleanup_count} sessions",
        "active_sessions_remaining": len(active_sessions),
        "errors": errors
    }

# --- NEW DATABASE-BASED ENDPOINTS ---

@app.post("/prepare-interview-context")
async def prepare_interview_context(request: PrepareRequest):
    """Prepare interview context by fetching job description and resume from database"""
    try:
        print(f"Preparing context for interview ID: {request.interviewId}")
        
        # Use Supabase REST API instead of direct database connection
        supabase = get_supabase_client()
        try:
            # Use Supabase to get interview data with related employee and job description
            response = supabase.table('interview_sessions').select(
                """
                *,
                xlsmart_employees!interview_sessions_employee_id_fkey(
                    first_name,
                    last_name,
                    current_position,
                    id
                ),
                xlsmart_job_descriptions!interview_sessions_job_description_id_fkey(
                    title,
                    summary,
                    id
                )
                """
            ).eq('id', request.interviewId).execute()
            
            if not response.data:
                raise HTTPException(status_code=404, detail="Interview session not found")
            
            interview_data = response.data[0]
            employee_data = interview_data['xlsmart_employees']
            job_data = interview_data['xlsmart_job_descriptions']
            
            job_desc = job_data.get('summary', '') if job_data else "No job description provided."
            
            # Note: XLSMART doesn't have resume files, using employee position instead
            resume_text = f"Employee Position: {employee_data.get('current_position', 'Not specified')}" if employee_data else "Employee data not available."
                
            # Return the prepared data to the frontend
            return {
                "jobDescription": job_desc,
                "resumeText": resume_text
            }
        except Exception as e:
            logger.error(f"Error in prepare_ai_assessment: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/interview-fairness/{session_id}")
async def get_interview_fairness(session_id: str):
    """Get fairness data for an active interview session"""
    try:
        interview_manager = active_sessions.get(session_id)
        if not interview_manager:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if not interview_manager.audio_handler:
            raise HTTPException(status_code=400, detail="Audio handler not available")
        
        fairness_data = interview_manager.audio_handler.get_assessment_fairness_data()
        
        return {
            "session_id": session_id,
            "interview_duration": interview_manager.interview_duration,
            "fairness_data": fairness_data,
            "current_topic_index": interview_manager.audio_handler.current_topic_index,
            "completed_topics": len(interview_manager.audio_handler.completed_topics),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/finalize-interview")
async def finalize_interview(request: FinalizeRequest):
    """Finalize interview with AI analysis and save results to database"""
    try:
        print(f"Finalizing interview: {request.interviewId}")

        # 1. Fetch interview data from Supabase
        try:
            response = supabase.table('interview_sessions').select(
                """
                *,
                xlsmart_employees!interview_sessions_employee_id_fkey(
                    first_name,
                    last_name,
                    current_position,
                    id
                ),
                xlsmart_job_descriptions!interview_sessions_job_description_id_fkey(
                    title,
                    summary,
                    required_qualifications,
                    required_skills,
                    id
                )
                """
            ).eq('id', request.interviewId).execute()
            
            if not response.data:
                raise HTTPException(status_code=404, detail="Interview session not found")
            
            interview_data = response.data[0]
            employee_data = interview_data['xlsmart_employees']
            job_data = interview_data['xlsmart_job_descriptions']
            
            # Get fairness data from active session if available
            fairness_data = {}
            interview_manager = None
            agenda_modules = []
            scoring_criteria = {}
            
            # Try to find the active session for this interview
            for session_id, manager in active_sessions.items():
                if hasattr(manager, 'interview_id') and str(manager.interview_id) == str(request.interviewId):
                    interview_manager = manager
                    break
            
            if interview_manager and interview_manager.audio_handler:
                try:
                    fairness_data = interview_manager.audio_handler.get_assessment_fairness_data()
                    logger.info(f"📊 Assessment fairness data collected: {fairness_data}")
                except:
                    fairness_data = {}
                    logger.warning("Could not retrieve fairness data from audio handler")
                    
                try:
                    agenda_modules = interview_manager.audio_handler.meeting_agenda.get('modules', []) if hasattr(interview_manager.audio_handler, 'meeting_agenda') and interview_manager.audio_handler.meeting_agenda else []
                except:
                    agenda_modules = []
                    
                try:
                    scoring_criteria = interview_manager.audio_handler.scoring_criteria if hasattr(interview_manager.audio_handler, 'scoring_criteria') else {}
                except:
                    scoring_criteria = {}
            else:
                logger.warning(f"⚠️ No active session found for interview {request.interviewId} - assessment may not account for question coverage")
            
            job_desc = job_data.get('summary', '') if job_data else ""
            job_requirements = job_data.get('required_qualifications', []) if job_data else []
            skills_required = job_data.get('required_skills', []) if job_data else []
            transcript_data = interview_data.get('transcript', {})
            job_title = job_data.get('title', 'position') if job_data else "position"

            # Extract transcript from the stored data or use provided transcript
            live_transcript = []
            if hasattr(request, 'transcript') and request.transcript:
                # Use provided transcript from request
                live_transcript = request.transcript if isinstance(request.transcript, list) else []
                logger.info(f"📋 Using provided transcript from request: {len(live_transcript)} entries")
            elif transcript_data:
                logger.info(f"📋 Found transcript_data of type: {type(transcript_data)}")
                if isinstance(transcript_data, str):
                    try:
                        transcript_data = json.loads(transcript_data)
                        logger.info(f"📋 Parsed transcript_data from JSON string")
                    except Exception as parse_error:
                        logger.error(f"❌ Failed to parse transcript JSON: {parse_error}")
                        transcript_data = {}
                live_transcript = transcript_data.get('live_transcript', [])
                logger.info(f"📋 Extracted live_transcript: {len(live_transcript)} entries")
                if live_transcript:
                    logger.info(f"📋 Sample transcript entry: {live_transcript[0] if live_transcript else 'None'}")
            else:
                logger.warning(f"⚠️ No transcript data found for interview {request.interviewId}")

            # 2. Process live_transcript into simplified appended text format
            transcript_text = "No interview transcript available"
            if live_transcript:
                logger.info(f"📋 Processing {len(live_transcript)} transcript entries")
                # Filter only audio messages (actual conversation), skip system messages
                audio_messages = [
                    msg for msg in live_transcript 
                    if msg.get('type') == 'audio' and msg.get('content', '').strip()
                ]
                logger.info(f"📋 Found {len(audio_messages)} audio messages out of {len(live_transcript)} total entries")
                
                # Create simplified appended text format
                transcript_lines = []
                for msg in audio_messages:
                    speaker = msg.get('speaker', 'Unknown')
                    content = msg.get('content', '').strip()
                    if content:
                        # Simplified format: Speaker: Content
                        transcript_lines.append(f"{speaker.capitalize()}: {content}")
                
                logger.info(f"📋 Created {len(transcript_lines)} transcript lines from audio messages")
                transcript_text = "\n".join(transcript_lines) if transcript_lines else "No interview transcript available"
                
                if transcript_text == "No interview transcript available":
                    logger.warning(f"⚠️ No valid transcript content found despite having {len(live_transcript)} entries")
                    # Log a few sample entries for debugging
                    for i, entry in enumerate(live_transcript[:3]):
                        logger.info(f"📋 Sample entry {i+1}: {json.dumps(entry, indent=2)}")
            else:
                logger.warning(f"⚠️ No live_transcript data to process")

            # 3. Create agenda-synchronized evaluation prompt
                agenda_evaluation_context = ""
                if agenda_modules:
                    agenda_evaluation_context = f"""
MEETING AGENDA MODULES COVERED:
{chr(10).join([f"• {module['title']} ({module['duration_minutes']} min) - Objectives: {', '.join(module['objectives'])}" for module in agenda_modules])}

AGENDA-BASED EVALUATION CRITERIA:
{chr(10).join([f"• {module['title']}: {', '.join(module['evaluation_criteria'])}" for module in agenda_modules])}

The interview followed a structured agenda. Evaluate the candidate's performance against each module's specific objectives and criteria listed above.
"""
                
                summary_prompt = f"""
You are an expert technical recruiter. Evaluate this candidate based on their interview performance, job requirements, and the structured meeting agenda that was followed.

JOB: {job_title}
DESCRIPTION: {job_desc}
REQUIRED SKILLS: {skills_required}
REQUIREMENTS: {job_requirements}

{agenda_evaluation_context}

INTERVIEW TRANSCRIPT:
{transcript_text}

TRADITIONAL EVALUATION CRITERIA (if available):
{json.dumps(scoring_criteria, indent=2) if scoring_criteria else 'Use standard interview evaluation criteria'}

ASSESSMENT FAIRNESS DATA:
{json.dumps(fairness_data, indent=2) if fairness_data else 'No specific fairness adjustments available'}

EVALUATION INSTRUCTIONS:
1. If a structured meeting agenda was followed (shown above), evaluate the candidate against each module's specific objectives and criteria
2. Cross-reference the candidate's responses with the agenda modules they were designed to assess
3. CRITICAL: Apply fairness adjustments based on the Assessment Fairness Data above:
   - If a module has low question coverage (< 50%), reduce its weight in the final assessment
   - If no questions were asked for a module, do NOT penalize the candidate for that module
   - Focus evaluation on modules where adequate questions were asked
   - Adjust overall scoring to account for uneven question distribution
4. Provide module-specific performance assessment in the skills_assessment section
5. Use both agenda-based criteria AND traditional scoring criteria for a comprehensive evaluation

FAIRNESS PRINCIPLE: Only evaluate what was actually assessed. If the interviewer didn't adequately explore a topic, don't penalize the candidate for lack of demonstration in that area.

Provide a JSON response with:
- "summary": Brief summary of candidate's performance across all agenda modules (2-3 sentences)
- "strengths": List of 2-3 key strengths shown in interview (reference specific agenda modules)
- "weaknesses": List of 2-3 areas for improvement (reference specific agenda modules)
- "score": Overall score from 0-100 based on agenda module performance and job requirements
- "skills_assessment": Performance on each required skill AND each agenda module objective
- "job_fit": How well the candidate fits the job based on structured interview responses
- "module_performance": If agenda modules exist, provide performance rating for each module (Excellent/Good/Average/Poor/Not_Assessed)
- "assessment_fairness": Include information about which modules were adequately assessed vs those with insufficient questioning
- "fairness_adjustments": List any score adjustments made due to uneven question coverage

IMPORTANT: Use "Not_Assessed" for modules where insufficient questions were asked (coverage < 30%). Do not provide performance ratings for inadequately assessed modules.

Score Guidelines:
90-100: Excellent performance across all agenda modules, exceeds job requirements
80-89: Good performance in most agenda modules, meets requirements
70-79: Average performance, some agenda modules well-covered
60-69: Below average, several agenda modules poorly addressed
50-59: Poor performance across agenda modules
0-49: Very poor, failed most agenda objectives
"""

                # 4. Call ProxyLLM with enhanced agenda-aware analysis
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            settings.PROXYLLM_URL,
                            headers={"Authorization": f"Bearer {settings.PROXYLLM_KEY}", "Content-Type": "application/json"},
                            json={
                                "model": settings.PROXYLLM_MODEL,
                                "messages": [{"role": "user", "content": summary_prompt}],
                                "response_format": {"type": "json_object"}, # Force the output to be JSON
                                "temperature": 0.3  # Lower temperature for more consistent evaluation
                            },
                            timeout=120.0 # Allow more time for comprehensive analysis
                        )
                    response.raise_for_status()
                    analysis_json = response.json()["choices"][0]["message"]["content"]
                    analysis_data = json.loads(analysis_json) # Convert the JSON string into a Python dictionary
                except Exception as ai_error:
                    logger.error(f"AI analysis failed: {ai_error}")
                    # Create default analysis data if AI fails
                    analysis_data = {
                        "summary": "Interview completed but AI analysis failed.",
                        "strengths": ["Interview participation"],
                        "weaknesses": ["AI analysis unavailable"],
                        "score": 50,
                        "skills_assessment": {},
                        "job_fit": "Unable to determine due to analysis failure"
                    }

                # 5. Save the structured results to interview_sessions table
                print(f"Analysis Data: {json.dumps(analysis_data, indent=2)}")  
                
                # Prepare simplified AI review data with safe defaults
                ai_review_data = {
                    "summary": analysis_data.get("summary", "No summary available"),
                    "strengths": analysis_data.get("strengths", []),
                    "weaknesses": analysis_data.get("weaknesses", []),
                    "skills_assessment": analysis_data.get("skills_assessment", {}),
                    "job_fit": analysis_data.get("job_fit", ""),
                    "evaluation_criteria": scoring_criteria,
                    "required_skills": skills_required,
                    "job_requirements": job_requirements,
                    "detailed_evaluation": analysis_data
                }
                
                # Prepare data for interview_sessions table
                transcript_data_final = {
                    "conversation": transcript_text,
                    "live_transcript": live_transcript if live_transcript else []
                }
                
                skill_scores_data = analysis_data.get("skills_assessment", {})
                recommendations_array = analysis_data.get("recommendations", [])
                strengths_array = analysis_data.get("strengths", [])
                areas_for_improvement_array = analysis_data.get("weaknesses", [])
                
                # Update interview_sessions using global Supabase client
                try:
                    result = supabase.table('interview_sessions').update({
                        'status': 'completed',
                        'transcript': transcript_data_final,
                        'ai_analysis': analysis_data,
                        'overall_score': analysis_data.get("score", 0),
                        'skill_scores': skill_scores_data,
                        'recommendations': recommendations_array,
                        'strengths': strengths_array,
                        'areas_for_improvement': areas_for_improvement_array,
                        'completed_at': datetime.now().isoformat()
                    }).eq('id', request.interviewId).execute()
                    
                    logger.info(f"✅ Interview {request.interviewId} finalized successfully")
                    return {"success": True, "message": "Interview evaluation completed using live transcript and job requirements."}
                    
                except Exception as db_error:
                    logger.error(f"Database update failed: {db_error}")
                    raise HTTPException(status_code=500, detail=f"Failed to save interview results: {str(db_error)}")

        except Exception as e:
            logger.error(f"Error in finalize_interview: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-interview-report")
async def get_interview_report(request: ReportRequest):
    """Get interview report with AI analysis results"""
    try:
        print(f"Fetching report for interview ID: {request.interviewId}")

        # Use Supabase to get interview report data
        response = supabase.table('interview_sessions').select(
            """
            *,
            xlsmart_employees!interview_sessions_employee_id_fkey(
                first_name,
                last_name,
                id
            ),
            xlsmart_job_descriptions!interview_sessions_job_description_id_fkey(
                title,
                id
            )
            """
        ).eq('id', request.interviewId).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Interview report not found.")

        interview_data = response.data[0]
        employee_data = interview_data['xlsmart_employees']
        job_data = interview_data['xlsmart_job_descriptions']
        
        # Parse the AI analysis data
        ai_analysis = interview_data.get('ai_analysis', {})
        if isinstance(ai_analysis, str):
            ai_analysis = json.loads(ai_analysis)
            
        transcript_data = interview_data.get('transcript', {})
        if isinstance(transcript_data, str):
            transcript_data = json.loads(transcript_data)
        
        # Structure the response to match the expected format
        return {
            "ai_summary": ai_analysis.get('summary', ''),
            "ai_score": float(interview_data['overall_score']) if interview_data.get('overall_score') else None,
            "transcript": transcript_data,
            "strengths": interview_data.get('strengths', []),
            "weaknesses": interview_data.get('areas_for_improvement', []),
            "scoring_breakdown": ai_analysis.get('scoring_breakdown', {}),
            "application": {
                "candidate": {
                    "first_name": employee_data.get('first_name', '') if employee_data else '',
                    "last_name": employee_data.get('last_name', '') if employee_data else ''
                },
                "job": {
                    "title": job_data.get('title', '') if job_data else ''
                }
            },
            "recommendations": interview_data.get('recommendations', [])
        }
    except Exception as e:
        logger.error(f"Error in get_interview_report: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Direct interview interface - auto-starts interview
@app.get("/interview")
async def get_interview_interface(session_id: str = None):
    """
    Direct interview interface that auto-starts the interview
    """
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>AI Interview - Live</title>
        <style>
            body {{ 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
            }}
            .container {{ 
                max-width: 900px; 
                margin: 0 auto; 
                background: rgba(255,255,255,0.1); 
                border-radius: 15px; 
                padding: 30px;
                backdrop-filter: blur(10px);
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid rgba(255,255,255,0.3);
            }}
            .status {{
                display: flex;
                justify-content: space-between;
                margin: 20px 0;
                padding: 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
            }}
            .controls {{
                text-align: center;
                margin: 30px 0;
            }}
            button {{
                padding: 15px 30px;
                margin: 10px;
                border: none;
                border-radius: 25px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
            }}
            .primary-btn {{
                background: #28a745;
                color: white;
            }}
            .primary-btn:hover {{
                background: #218838;
                transform: translateY(-2px);
            }}
            .danger-btn {{
                background: #dc3545;
                color: white;
            }}
            .danger-btn:hover {{
                background: #c82333;
                transform: translateY(-2px);
            }}
            .secondary-btn {{
                background: #6c757d;
                color: white;
            }}
            .secondary-btn:hover {{
                background: #5a6268;
                transform: translateY(-2px);
            }}
            button:disabled {{
                background: #6c757d;
                cursor: not-allowed;
                transform: none;
            }}
            #messages {{
                height: 400px;
                overflow-y: auto;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 10px;
                padding: 20px;
                background: rgba(0,0,0,0.2);
                margin: 20px 0;
            }}
            .message {{
                margin: 10px 0;
                padding: 12px;
                border-radius: 10px;
                line-height: 1.5;
            }}
            .ai-message {{
                background: rgba(40, 167, 69, 0.3);
                border-left: 4px solid #28a745;
            }}
            .user-message {{
                background: rgba(0, 123, 255, 0.3);
                border-left: 4px solid #007bff;
            }}
            .system-message {{
                background: rgba(255, 193, 7, 0.3);
                border-left: 4px solid #ffc107;
                font-style: italic;
            }}
            .error-message {{
                background: rgba(220, 53, 69, 0.3);
                border-left: 4px solid #dc3545;
            }}
            .recording {{
                animation: pulse 1.5s infinite;
            }}
            @keyframes pulse {{
                0% {{ transform: scale(1); }}
                50% {{ transform: scale(1.1); }}
                100% {{ transform: scale(1); }}
            }}
            .input-section {{
                display: flex;
                gap: 10px;
                margin: 20px 0;
            }}
            #textInput {{
                flex: 1;
                padding: 12px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 25px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 16px;
            }}
            #textInput::placeholder {{
                color: rgba(255,255,255,0.7);
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎤 AI Interview Session</h1>
                <div class="status">
                    <div><strong>Session:</strong> <span id="sessionDisplay">{session_id or "Loading..."}</span></div>
                    <div><strong>Status:</strong> <span id="statusDisplay">Connecting...</span></div>
                    <div><strong>Mode:</strong> <span id="modeDisplay">Voice & Text</span></div>
                </div>
            </div>

            <div class="controls">
                <button onclick="enableAudio()" id="enableAudioBtn" class="primary-btn">🎤 Enable Audio</button>
                <button onclick="startRecording()" id="startBtn" class="primary-btn" disabled>🗣️ Start Speaking</button>
                <button onclick="stopRecording()" id="stopBtn" class="danger-btn" disabled>⏹️ Stop Speaking</button>
                <button onclick="endInterview()" id="endBtn" class="danger-btn" disabled>🚪 End Interview</button>
            </div>

            <div class="input-section">
                <input type="text" id="textInput" placeholder="Type your response here..." disabled />
                <button onclick="sendTextMessage()" id="sendTextBtn" class="secondary-btn" disabled>Send</button>
            </div>

            <div id="messages"></div>
        </div>

        <script>
            const SESSION_ID = "{session_id}";
            let websocket = null;
            let audioContext = null;
            let audioSource = null;
            let audioProcessor = null;
            let mediaStream = null;
            let audioPlaybackContext = null;
            let audioQueue = [];
            let isPlayingAudio = false;

            // Auto-start the interview
            window.addEventListener('DOMContentLoaded', function() {{
                if (SESSION_ID && SESSION_ID !== "None") {{
                    addMessage(`Starting interview session: ${{SESSION_ID}}`, 'system');
                    connectWebSocket();
                }} else {{
                    addMessage('No session ID provided. Please start from XLSMART dashboard.', 'error');
                }}
            }});

            async function connectWebSocket() {{
                try {{
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const host = window.location.host;
                    const wsUrl = `${{protocol}}//${{host}}/ws/interview/${{SESSION_ID}}`;
                    
                    addMessage('Connecting to interview session...', 'system');
                    websocket = new WebSocket(wsUrl);
                    
                    websocket.onopen = function(event) {{
                        addMessage('Connected! Interview is starting...', 'system');
                        document.getElementById('statusDisplay').textContent = 'Connected';
                        document.getElementById('enableAudioBtn').disabled = false;
                        document.getElementById('endBtn').disabled = false;
                        document.getElementById('textInput').disabled = false;
                        document.getElementById('sendTextBtn').disabled = false;
                    }};
                    
                    websocket.onmessage = function(event) {{
                        try {{
                            const data = JSON.parse(event.data);
                            
                            if (data.type === 'audio') {{
                                playAudio(data.audio);
                            }} else if (data.type === 'text') {{
                                addMessage(data.content, 'ai');
                            }} else if (data.type === 'transcript') {{
                                addMessage(`You said: ${{data.content}}`, 'user');
                            }} else if (data.type === 'error') {{
                                addMessage(`Error: ${{data.content}}`, 'error');
                            }}
                        }} catch (error) {{
                            addMessage(`Received: ${{event.data}}`, 'ai');
                        }}
                    }};
                    
                    websocket.onerror = function(error) {{
                        addMessage('Connection error occurred', 'error');
                        document.getElementById('statusDisplay').textContent = 'Error';
                    }};
                    
                    websocket.onclose = function(event) {{
                        addMessage('Interview session ended', 'system');
                        document.getElementById('statusDisplay').textContent = 'Disconnected';
                        document.getElementById('enableAudioBtn').disabled = true;
                        document.getElementById('startBtn').disabled = true;
                        document.getElementById('stopBtn').disabled = true;
                        document.getElementById('endBtn').disabled = true;
                        document.getElementById('textInput').disabled = true;
                        document.getElementById('sendTextBtn').disabled = true;
                    }};
                    
                }} catch (error) {{
                    addMessage('Failed to connect: ' + error.message, 'error');
                }}
            }}

            async function enableAudio() {{
                try {{
                    mediaStream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioSource = audioContext.createMediaStreamSource(mediaStream);
                    
                    addMessage('Audio enabled! You can now speak.', 'system');
                    document.getElementById('enableAudioBtn').disabled = true;
                    document.getElementById('startBtn').disabled = false;
                    document.getElementById('modeDisplay').textContent = 'Voice & Text Ready';
                }} catch (error) {{
                    addMessage('Failed to enable audio: ' + error.message, 'error');
                    addMessage('You can still use text chat!', 'system');
                }}
            }}

            function startRecording() {{
                if (websocket && websocket.readyState === WebSocket.OPEN && audioContext) {{
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = false;
                    document.getElementById('startBtn').classList.add('recording');
                    
                    // Create audio processor
                    audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                    audioProcessor.onaudioprocess = function(event) {{
                        const inputData = event.inputBuffer.getChannelData(0);
                        const audioData = Array.from(inputData);
                        
                        if (websocket.readyState === WebSocket.OPEN) {{
                            websocket.send(JSON.stringify({{
                                type: 'audio',
                                audio: audioData
                            }}));
                        }}
                    }};
                    
                    audioSource.connect(audioProcessor);
                    audioProcessor.connect(audioContext.destination);
                    
                    addMessage('🎤 Recording... Speak now!', 'system');
                }}
            }}

            function stopRecording() {{
                if (audioProcessor) {{
                    audioProcessor.disconnect();
                    audioProcessor = null;
                }}
                
                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
                document.getElementById('startBtn').classList.remove('recording');
                
                addMessage('Recording stopped.', 'system');
            }}

            function sendTextMessage() {{
                const textInput = document.getElementById('textInput');
                const message = textInput.value.trim();
                
                if (message && websocket && websocket.readyState === WebSocket.OPEN) {{
                    websocket.send(JSON.stringify({{
                        type: 'text',
                        content: message
                    }}));
                    
                    addMessage(`You: ${{message}}`, 'user');
                    textInput.value = '';
                }}
            }}

            function endInterview() {{
                if (websocket) {{
                    websocket.close();
                }}
                if (mediaStream) {{
                    mediaStream.getTracks().forEach(track => track.stop());
                }}
                addMessage('Interview ended by user.', 'system');
            }}

            function playAudio(audioData) {{
                // Audio playback implementation
                if (!audioPlaybackContext) {{
                    audioPlaybackContext = new (window.AudioContext || window.webkitAudioContext)();
                }}
                
                const audioBuffer = audioPlaybackContext.createBuffer(1, audioData.length, 24000);
                const channelData = audioBuffer.getChannelData(0);
                for (let i = 0; i < audioData.length; i++) {{
                    channelData[i] = audioData[i];
                }}
                
                const source = audioPlaybackContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioPlaybackContext.destination);
                source.start(0);
            }}

            function addMessage(message, type = 'system') {{
                const messagesDiv = document.getElementById('messages');
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${{type}}-message`;
                messageDiv.innerHTML = `<strong>${{new Date().toLocaleTimeString()}}:</strong> ${{message}}`;
                messagesDiv.appendChild(messageDiv);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }}

            // Handle Enter key in text input
            document.getElementById('textInput').addEventListener('keypress', function(e) {{
                if (e.key === 'Enter') {{
                    sendTextMessage();
                }}
            }});

            // Warn before leaving during active interview
            window.addEventListener('beforeunload', function(e) {{
                if (websocket && websocket.readyState === WebSocket.OPEN) {{
                    e.preventDefault();
                    e.returnValue = 'You have an active interview. Are you sure you want to leave?';
                    return 'You have an active interview. Are you sure you want to leave?';
                }}
            }});
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# HTML client for testing
@app.get("/client")
async def get_client():
    """
    Simple HTML client for testing the interview WebSocket
    """
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>AI Interview Client</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            button { padding: 10px 15px; margin: 5px; }
            textarea { width: 100%; height: 100px; }
            #messages { height: 300px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
            .message { margin: 5px 0; padding: 5px; background: #f5f5f5; }
            .ai-message { background: #e8f5e8; }
            .user-message { background: #f0f8ff; }
            .error-message { background: #ffe8e8; }
            
            /* Tab styles */
            .tab-button {
                background: #f0f0f0;
                border: 1px solid #ddd;
                padding: 10px 20px;
                cursor: pointer;
                border-radius: 5px 5px 0 0;
                margin-right: 2px;
            }
            .tab-button.active {
                background: #007bff;
                color: white;
                border-bottom: 1px solid #007bff;
            }
            .tab-content {
                display: none;
                padding: 15px;
                border: 1px solid #ddd;
                border-top: none;
                border-radius: 0 5px 5px 5px;
                background: white;
            }
            .tab-content.active {
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>AI Interview Client</h1>
            
            <div class="section" style="background: #f0f8ff;">
                <h3>🔧 Setup Instructions</h3>
                <p><strong>For Audio to work:</strong></p>
                <ul>
                    <li>Use <strong>Chrome, Firefox, or Edge</strong> browser</li>
                    <li>Access via <strong>https://</strong> or <strong>localhost:8000</strong> (not 127.0.0.1)</li>
                    <li>Allow microphone permissions when prompted</li>
                    <li>Use headphones to prevent echo</li>
                </ul>
                <p><strong>Interview Options:</strong></p>
                <ul>
                    <li><strong>Manual Entry:</strong> Create interview with job description and resume text</li>
                    <li><strong>Database Interview:</strong> Use existing interview schedule ID with automatic data fetching and live transcription</li>
                </ul>
                <p><strong>Text chat works everywhere!</strong> No special setup needed.</p>
                <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 3px;">
                    <strong>Browser Status:</strong><br>
                    <div id="browserStatus">Checking compatibility...</div>
                </div>
            </div>
            
            <div class="section">
                <h3>Start Interview</h3>
                
                <!-- Tab buttons -->
                <div style="margin-bottom: 15px;">
                    <button onclick="showTab('manual')" id="manualTab" class="tab-button active">Manual Entry</button>
                    <button onclick="showTab('database')" id="databaseTab" class="tab-button">Database Interview</button>
                </div>
                
                <!-- Manual Interview Tab -->
                <div id="manualInterview" class="tab-content active">
                    <h4>Create New Interview Session</h4>
                    <div>
                        <label>Job Description:</label>
                        <textarea id="jobDescription" placeholder="Enter job description...">Software Engineer position requiring Python, FastAPI, and WebSocket experience. Looking for someone with 3+ years of backend development experience.</textarea>
                    </div>
                    <div>
                        <label>Resume:</label>
                        <textarea id="resume" placeholder="Enter resume text...">John Doe - Software Developer with 5 years experience in Python, FastAPI, Django. Built several REST APIs and WebSocket applications.</textarea>
                    </div>
                    <div>
                        <label>Candidate Name:</label>
                        <input type="text" id="candidateName" placeholder="Enter candidate name..." value="John Doe" />
                    </div>
                    <button onclick="startInterview()">Start Manual Interview</button>
                </div>
                
                <!-- Database Interview Tab -->
                <div id="databaseInterview" class="tab-content">
                    <h4>Start Database Interview</h4>
                    <div>
                        <label>Interview ID:</label>
                        <input type="text" id="interviewId" placeholder="Enter interview schedule ID (UUID)..." style="width: 100%; padding: 8px; margin: 5px 0;" />
                        <small style="color: #666;">Enter the UUID of the interview schedule from your database</small>
                    </div>
                    <button onclick="startDatabaseInterview()">Start Database Interview</button>
                    <div id="databaseInterviewInfo" style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 5px; display: none;">
                        <strong>Interview Details:</strong>
                        <div id="interviewDetails"></div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h3>Communication</h3>
                <button onclick="connectWebSocket()" id="connectBtn" disabled>Connect to Interview</button>
                <button onclick="viewLiveTranscript()" id="transcriptBtn" disabled style="background: #28a745; color: white;">View Live Transcript</button>
                <button onclick="endInterview()" id="endBtn" disabled style="background-color: #dc3545; color: white;">End Interview</button>
                <br><br>
                <div>
                    <input type="text" id="textInput" placeholder="Type a message..." style="width: 70%;" />
                    <button onclick="sendTextMessage()" id="sendTextBtn" disabled>Send Text</button>
                </div>
                <br>
                <button onclick="enableAudio()" id="enableAudioBtn">Enable Audio</button>
                <button onclick="startRecording()" id="startBtn" disabled>Start Speaking</button>
                <button onclick="stopRecording()" id="stopBtn" disabled>Stop Speaking</button>
            </div>
            
            <div class="section">
                <h3>Messages</h3>
                <div id="messages"></div>
            </div>
        </div>

        <script>
            // Browser compatibility check
            function checkBrowserCompatibility() {
                const messages = [];
                
                // Check basic WebSocket support
                if (!window.WebSocket) {
                    messages.push('❌ WebSocket not supported');
                } else {
                    messages.push('✅ WebSocket supported');
                }
                
                // Check getUserMedia support
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    messages.push('❌ Microphone access not supported (audio disabled)');
                    messages.push('💡 Try: Chrome/Firefox with HTTPS or localhost');
                } else {
                    messages.push('✅ Microphone access supported');
                }
                
                // Check AudioContext support
                if (!window.AudioContext && !window.webkitAudioContext) {
                    messages.push('❌ Audio playback not supported');
                } else {
                    messages.push('✅ Audio playback supported');
                }
                
                // Check if running on HTTPS or localhost
                const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
                if (!isSecure) {
                    messages.push('⚠️ Not using HTTPS/localhost - audio may not work');
                    messages.push('💡 Try: http://localhost:8000/client');
                } else {
                    messages.push('✅ Secure context (HTTPS/localhost)');
                }
                
                // Show compatibility status
                const statusDiv = document.getElementById('browserStatus');
                statusDiv.innerHTML = messages.join('<br>');
            }

            let sessionId = null;
            let websocket = null;
            let audioContext = null;
            let audioSource = null;
            let audioProcessor = null;
            let mediaStream = null;
            let audioPlaybackContext = null;
            let audioQueue = [];
            let isPlayingAudio = false;
            let currentInterviewId = null; // Store current interview ID for database interviews

            // Tab management functions
            function showTab(tabName) {
                // Hide all tab contents
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Remove active class from all tab buttons
                document.querySelectorAll('.tab-button').forEach(button => {
                    button.classList.remove('active');
                });
                
                // Show selected tab content
                if (tabName === 'manual') {
                    document.getElementById('manualInterview').classList.add('active');
                    document.getElementById('manualTab').classList.add('active');
                } else if (tabName === 'database') {
                    document.getElementById('databaseInterview').classList.add('active');
                    document.getElementById('databaseTab').classList.add('active');
                }
            }

            async function startInterview() {
                const jobDescription = document.getElementById('jobDescription').value;
                const resume = document.getElementById('resume').value;
                const candidateName = document.getElementById('candidateName').value;

                if (!jobDescription || !resume) {
                    alert('Please fill in both job description and resume');
                    return;
                }

                try {
                    const response = await fetch('/start-interview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            job_description: jobDescription,
                            resume_text: resume,
                            candidate_name: candidateName || 'Candidate'
                        })
                    });

                    const data = await response.json();
                    sessionId = data.session_id;
                    currentInterviewId = null; // Clear any database interview ID
                    document.getElementById('connectBtn').disabled = false;
                    addMessage('Manual interview session created successfully!', 'system');
                } catch (error) {
                    addMessage('Error: ' + error.message, 'error');
                }
            }

            async function startDatabaseInterview() {
                const interviewId = document.getElementById('interviewId').value.trim();

                if (!interviewId) {
                    alert('Please enter an interview ID');
                    return;
                }

                // Validate UUID format (basic check)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(interviewId)) {
                    alert('Please enter a valid UUID format for the interview ID');
                    return;
                }

                try {
                    addMessage('Starting database interview...', 'system');
                    
                    const response = await fetch('/start-database-interview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            interview_id: interviewId
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || `HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    sessionId = data.session_id;
                    currentInterviewId = data.interview_id;
                    
                    // Show interview details
                    const infoDiv = document.getElementById('databaseInterviewInfo');
                    const detailsDiv = document.getElementById('interviewDetails');
                    
                    detailsDiv.innerHTML = `
                        <div><strong>Session ID:</strong> ${data.session_id}</div>
                        <div><strong>Interview ID:</strong> ${data.interview_id}</div>
                        <div><strong>Candidate:</strong> ${data.candidate_name}</div>
                        <div><strong>Status:</strong> Ready for connection</div>
                    `;
                    infoDiv.style.display = 'block';
                    
                    document.getElementById('connectBtn').disabled = false;
                    addMessage(`Database interview created for ${data.candidate_name}`, 'system');
                    addMessage('Live transcription enabled - conversation will be saved to database', 'system');
                    
                } catch (error) {
                    addMessage('Error starting database interview: ' + error.message, 'error');
                    
                    // Provide helpful error messages
                    if (error.message.includes('404')) {
                        addMessage('Interview ID not found in database. Please check the ID and try again.', 'error');
                    } else if (error.message.includes('500')) {
                        addMessage('Database connection error. Please check server configuration.', 'error');
                    }
                }
            }

            async function connectWebSocket() {
                if (!sessionId) return;

                // Dynamically construct WebSocket URL based on current location
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host;
                const wsUrl = `${protocol}//${host}/ws/interview/${sessionId}`;
                
                websocket = new WebSocket(wsUrl);

                websocket.onopen = () => {
                    const interviewType = currentInterviewId ? 'database interview' : 'manual interview';
                    addMessage(`Connected to ${interviewType} - AI will start speaking soon`, 'system');
                    
                    if (currentInterviewId) {
                        addMessage('Live transcription active - conversation being saved to database', 'system');
                        document.getElementById('transcriptBtn').disabled = false;
                    }
                    
                    document.getElementById('sendTextBtn').disabled = false;
                    document.getElementById('endBtn').disabled = false;
                };

                websocket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    
                    // Handle different message types with less noise
                    if (data.type === 'response.audio.delta' && data.delta) {
                        playAudioChunk(data.delta);
                    } else if (data.type === 'response.text.done' && data.text) {
                        addMessage('AI: ' + data.text, 'ai');
                    } else if (data.type === 'input_audio_buffer.speech_started') {
                        addMessage('🎤 AI detected your voice', 'system');
                    } else if (data.type === 'input_audio_buffer.speech_stopped') {
                        addMessage('🔇 Processing your response...', 'system');
                    } else if (data.type === 'response.done') {
                        addMessage('AI finished speaking', 'system');
                    } else if (data.type === 'response.created') {
                        // Clear audio queue for new response to prevent overlap
                        audioQueue = [];
                        addMessage('🤖 AI is responding...', 'system');
                    }
                    // Skip other message types to reduce noise
                };

                websocket.onclose = (event) => {
                    if (event.code === 1000) {
                        addMessage('Interview ended normally', 'system');
                    } else if (event.code === 4004) {
                        addMessage('Session not found or expired', 'error');
                    } else if (event.code === 1011) {
                        addMessage('Server error - interview terminated', 'error');
                    } else {
                        addMessage('Disconnected from interview - interview ended automatically', 'system');
                    }
                    
                    // Reset UI state
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = true;
                    document.getElementById('sendTextBtn').disabled = true;
                    document.getElementById('transcriptBtn').disabled = true;
                    document.getElementById('endBtn').disabled = true;
                    document.getElementById('connectBtn').disabled = false;
                    
                    // Clear session data
                    sessionId = null;
                    websocket = null;
                    currentInterviewId = null;
                };

                websocket.onerror = (error) => {
                    addMessage('Connection error occurred', 'error');
                    console.error('WebSocket error:', error);
                };
            }

            async function enableAudio() {
                try {
                    // Check browser support more thoroughly
                    if (!navigator.mediaDevices) {
                        throw new Error('Your browser does not support media devices. Please use Chrome, Firefox, or Edge with HTTPS.');
                    }
                    
                    if (!navigator.mediaDevices.getUserMedia) {
                        throw new Error('getUserMedia not supported. Please use a modern browser with HTTPS.');
                    }

                    // Test microphone access first
                    try {
                        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        testStream.getTracks().forEach(track => track.stop()); // Stop test stream
                        addMessage('Microphone access granted', 'system');
                    } catch (micError) {
                        if (micError.name === 'NotAllowedError') {
                            throw new Error('Microphone permission denied. Please allow microphone access and try again.');
                        } else if (micError.name === 'NotFoundError') {
                            throw new Error('No microphone found. Please connect a microphone and try again.');
                        } else {
                            throw new Error('Microphone error: ' + micError.message);
                        }
                    }

                    await initializeAudioPlayback();
                    addMessage('Audio system ready!', 'system');
                    document.getElementById('enableAudioBtn').disabled = true;
                    document.getElementById('startBtn').disabled = false;
                } catch (error) {
                    addMessage('Audio setup failed: ' + error.message, 'error');
                    addMessage('You can still use text chat below', 'system');
                }
            }

            async function initializeAudioPlayback() {
                if (!audioPlaybackContext) {
                    try {
                        audioPlaybackContext = new (window.AudioContext || window.webkitAudioContext)({
                            sampleRate: 24000
                        });
                        addMessage('Audio playback context created', 'system');
                    } catch (error) {
                        throw new Error('Failed to create audio context: ' + error.message);
                    }
                }
                
                if (audioPlaybackContext.state === 'suspended') {
                    try {
                        await audioPlaybackContext.resume();
                        addMessage('Audio context resumed', 'system');
                    } catch (error) {
                        throw new Error('Failed to resume audio context: ' + error.message);
                    }
                }
            }

            async function startRecording() {
                try {
                    // Double-check media devices support
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error('Media recording not supported in this browser/context. Please use Chrome/Firefox with HTTPS.');
                    }

                    addMessage('Requesting microphone access...', 'system');
                    
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            sampleRate: { ideal: 24000 },
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        } 
                    });
                    
                    addMessage('Microphone access granted, initializing...', 'system');
                    
                    // Create audio context with better error handling
                    try {
                        audioContext = new (window.AudioContext || window.webkitAudioContext)({
                            sampleRate: 24000
                        });
                    } catch (error) {
                        throw new Error('Failed to create audio context: ' + error.message);
                    }
                    
                    // Ensure audio context is running
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    
                    audioSource = audioContext.createMediaStreamSource(stream);
                    
                    // Use createScriptProcessor with better browser compatibility
                    try {
                        audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                    } catch (error) {
                        // Fallback for older browsers
                        audioProcessor = audioContext.createJavaScriptNode(4096, 1, 1);
                    }
                    
                    audioProcessor.onaudioprocess = function(event) {
                        if (websocket && websocket.readyState === WebSocket.OPEN) {
                            const inputData = event.inputBuffer.getChannelData(0);
                            
                            // Convert Float32Array to Int16Array (PCM16)
                            const pcm16Data = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                pcm16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                            }
                            
                            // Convert to base64
                            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16Data.buffer)));
                            
                            websocket.send(JSON.stringify({
                                type: 'audio',
                                audio: base64Audio
                            }));
                        }
                    };
                    
                    audioSource.connect(audioProcessor);
                    audioProcessor.connect(audioContext.destination);
                    
                    mediaStream = stream;
                    
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = false;
                    addMessage('🎤 Recording started - speak now!', 'user');
                    
                } catch (error) {
                    addMessage('Recording failed: ' + error.message, 'error');
                    
                    // Provide specific guidance based on error type
                    if (error.name === 'NotAllowedError') {
                        addMessage('Please click the microphone icon in your browser and allow access', 'system');
                    } else if (error.name === 'NotFoundError') {
                        addMessage('No microphone detected. Please connect a microphone', 'system');
                    } else if (error.message.includes('HTTPS')) {
                        addMessage('Try accessing via https:// or use localhost instead of 127.0.0.1', 'system');
                    }
                    
                    // Reset button states
                    document.getElementById('startBtn').disabled = false;
                    document.getElementById('stopBtn').disabled = true;
                }
            }

            function stopRecording() {
                try {
                    // Clean up audio processing
                    if (audioProcessor) {
                        audioProcessor.disconnect();
                        audioProcessor = null;
                    }
                    if (audioSource) {
                        audioSource.disconnect();
                        audioSource = null;
                    }
                    if (audioContext) {
                        audioContext.close();
                        audioContext = null;
                    }
                    if (mediaStream) {
                        mediaStream.getTracks().forEach(track => track.stop());
                        mediaStream = null;
                    }
                    
                    // Signal end of audio to server
                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                        websocket.send(JSON.stringify({
                            type: 'audio_end'
                        }));
                    }
                    
                    document.getElementById('startBtn').disabled = false;
                    document.getElementById('stopBtn').disabled = true;
                    addMessage('🔇 Stopped speaking', 'user');
                } catch (error) {
                    addMessage('Error stopping recording: ' + error.message, 'error');
                }
            }

            async function playAudioChunk(base64Audio) {
                // Add to queue instead of playing immediately
                audioQueue.push(base64Audio);
                
                // Start processing queue if not already playing
                if (!isPlayingAudio) {
                    processAudioQueue();
                }
            }

            async function processAudioQueue() {
                if (isPlayingAudio || audioQueue.length === 0) {
                    return;
                }
                
                isPlayingAudio = true;
                
                try {
                    await initializeAudioPlayback();
                    
                    while (audioQueue.length > 0) {
                        const base64Audio = audioQueue.shift();
                        await playAudioChunkNow(base64Audio);
                    }
                } catch (error) {
                    console.log('Audio queue processing error:', error);
                } finally {
                    isPlayingAudio = false;
                }
            }

            async function playAudioChunkNow(base64Audio) {
                return new Promise((resolve, reject) => {
                    try {
                        // Decode base64 to binary
                        const binaryString = atob(base64Audio);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        
                        // Convert PCM16 to Float32 for Web Audio API
                        const pcm16Data = new Int16Array(bytes.buffer);
                        
                        if (pcm16Data.length === 0) {
                            resolve();
                            return;
                        }
                        
                        const audioBuffer = audioPlaybackContext.createBuffer(1, pcm16Data.length, 24000);
                        const channelData = audioBuffer.getChannelData(0);
                        
                        for (let i = 0; i < pcm16Data.length; i++) {
                            channelData[i] = pcm16Data[i] / 32768.0; // Convert to float32 range [-1, 1]
                        }
                        
                        // Play the audio
                        const source = audioPlaybackContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(audioPlaybackContext.destination);
                        
                        // Resolve when audio finishes playing
                        source.onended = () => {
                            resolve();
                        };
                        
                        source.start(0);
                        
                        // Fallback timeout in case onended doesn't fire
                        setTimeout(() => {
                            resolve();
                        }, (audioBuffer.duration * 1000) + 100);
                        
                    } catch (error) {
                        console.log('Audio playback error:', error);
                        reject(error);
                    }
                });
            }

            async function viewLiveTranscript() {
                if (!currentInterviewId) {
                    addMessage('Live transcript only available for database interviews', 'system');
                    return;
                }

                try {
                    addMessage('Fetching live transcript...', 'system');
                    
                    const response = await fetch(`/interview/${currentInterviewId}/live-transcript`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    const transcript = data.live_transcript || [];
                    
                    if (transcript.length === 0) {
                        addMessage('No transcript entries found yet', 'system');
                        return;
                    }

                    addMessage(`📝 Live Transcript (${transcript.length} entries):`, 'system');
                    
                    // Show last 10 entries to avoid flooding the UI
                    const recentEntries = transcript.slice(-10);
                    
                    recentEntries.forEach(entry => {
                        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
                        const speaker = entry.speaker.charAt(0).toUpperCase() + entry.speaker.slice(1);
                        const content = entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '');
                        
                        let messageType = 'system';
                        if (entry.speaker === 'user') messageType = 'user';
                        else if (entry.speaker === 'assistant') messageType = 'ai';
                        
                        addMessage(`[${timestamp}] ${speaker}: ${content}`, messageType);
                    });
                    
                    if (transcript.length > 10) {
                        addMessage(`... showing last 10 of ${transcript.length} total entries`, 'system');
                    }
                    
                } catch (error) {
                    addMessage('Error fetching live transcript: ' + error.message, 'error');
                }
            }

            async function endInterview() {
                if (!sessionId || !websocket || websocket.readyState !== WebSocket.OPEN) {
                    addMessage('No active interview to end', 'error');
                    return;
                }
                
                if (!confirm('Are you sure you want to end the interview?')) {
                    return;
                }
                
                try {
                    // Close WebSocket connection gracefully
                    websocket.close(1000, 'Interview ended by user');
                    
                    // Call the API to end the session
                    const response = await fetch(`/session/${sessionId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        addMessage('Interview ended successfully', 'system');
                        if (data.interview_id) {
                            addMessage(`Database interview ${data.interview_id} status updated`, 'system');
                        }
                    } else {
                        addMessage('Error ending interview session', 'error');
                    }
                } catch (error) {
                    addMessage('Error ending interview: ' + error.message, 'error');
                }
            }

            function sendTextMessage() {
                const textInput = document.getElementById('textInput');
                const message = textInput.value.trim();
                
                if (!message) {
                    addMessage('Please enter a message', 'system');
                    return;
                }
                
                if (!websocket || websocket.readyState !== WebSocket.OPEN) {
                    addMessage('Not connected to interview', 'error');
                    return;
                }
                
                try {
                    websocket.send(JSON.stringify({
                        type: 'text',
                        content: message
                    }));
                    
                    addMessage('You: ' + message, 'user');
                    textInput.value = '';
                } catch (error) {
                    addMessage('Error sending text: ' + error.message, 'error');
                }
            }

            // Handle Enter key in text input and run compatibility check
            document.addEventListener('DOMContentLoaded', function() {
                // Run browser compatibility check
                checkBrowserCompatibility();
                
                const textInput = document.getElementById('textInput');
                if (textInput) {
                    textInput.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            sendTextMessage();
                        }
                    });
                }
                
                // Handle Enter key in interview ID input
                const interviewIdInput = document.getElementById('interviewId');
                if (interviewIdInput) {
                    interviewIdInput.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            startDatabaseInterview();
                        }
                    });
                }
                
                // Warn user before leaving page during active interview
                window.addEventListener('beforeunload', function(e) {
                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                        e.preventDefault();
                        e.returnValue = 'You have an active interview. Are you sure you want to leave?';
                        return 'You have an active interview. Are you sure you want to leave?';
                    }
                });
            });

            function addMessage(message, type = 'system') {
                const messagesDiv = document.getElementById('messages');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message';
                
                // Add appropriate CSS class based on message type
                if (type === 'ai') {
                    messageDiv.className += ' ai-message';
                } else if (type === 'user') {
                    messageDiv.className += ' user-message';
                } else if (type === 'error') {
                    messageDiv.className += ' error-message';
                }
                
                messageDiv.textContent = new Date().toLocaleTimeString() + ': ' + message;
                messagesDiv.appendChild(messageDiv);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }

            // Auto-handle URL parameters on page load
            window.addEventListener('DOMContentLoaded', function() {
                checkBrowserCompatibility();
                
                // Check for session_id parameter in URL
                const urlParams = new URLSearchParams(window.location.search);
                const sessionIdParam = urlParams.get('session_id');
                
                if (sessionIdParam) {
                    // Switch to database interview tab
                    showTab('database');
                    
                    // Set the interview ID field
                    document.getElementById('interviewId').value = sessionIdParam;
                    
                    // Auto-start the database interview
                    addMessage('Auto-starting interview from URL parameter...', 'system');
                    setTimeout(() => {
                        startDatabaseInterview();
                    }, 500); // Small delay to ensure UI is ready
                }
            });
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008, log_level="info")
