import asyncio
import json
import logging
import base64
import time
from typing import Optional, Callable
import websockets
import httpx
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os

logger = logging.getLogger(__name__)

# Database configuration for transcription storage
def get_db_connection():
    """Get direct PostgreSQL database connection for transcription storage"""
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "aws-0-ap-southeast-1.pooler.supabase.com"),
            database=os.getenv("DB_NAME", "postgres"),
            user=os.getenv("DB_USER", "postgres.wtwhyndtvxecpsyrpvll"),
            password=os.getenv("DB_PASS", "Suraj@55225522"),
            port=int(os.getenv("DB_PORT", "5432")),
            cursor_factory=RealDictCursor
        )
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

class AzureRealtimeAudioHandler:
    """
    Azure OpenAI Realtime API handler with ephemeral key authentication and billing protection
    """
    
    def __init__(self, azure_endpoint: str, api_key: str, deployment_name: str, api_version: str = "2024-12-17"):
        self.azure_endpoint = azure_endpoint.rstrip('/')
        self.api_key = api_key
        self.deployment_name = deployment_name
        self.api_version = api_version
        
        # Connection state
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.session_config = None
        
        # Note: No longer using ephemeral keys or Azure session IDs - using direct API key auth
        
        # Billing protection
        self.connection_timeout = 3600  # 1 hour max connection time
        self.start_time = None
        
        # Determine region for WebSocket URL
        self.websocket_region = self._extract_region_from_endpoint()
        
    def _extract_region_from_endpoint(self) -> str:
        """Extract region from Azure endpoint for WebSocket connection"""
        # Extract region from endpoint like: https://myresource-eastus2.openai.azure.com
        # or https://eastus2.openai.azure.com
        
        if "eastus2" in self.azure_endpoint.lower():
            return "eastus2"
        elif "swedencentral" in self.azure_endpoint.lower():
            return "swedencentral"
        else:
            # Default to eastus2 if can't determine
            logger.warning(f"Cannot determine region from endpoint {self.azure_endpoint}, defaulting to eastus2")
            return "eastus2"
    
    # Note: Ephemeral key method removed - now using direct API key authentication
    # async def _get_ephemeral_key(self, session_instructions: str, voice: str = "alloy") -> tuple[str, str]:
    
    async def connect(self, session_instructions: str) -> bool:
        """
        Connect to Azure OpenAI Realtime API with direct API key authentication
        """
        try:
            # According to Microsoft docs, construct WebSocket URL as:
            # wss://my-eastus2-openai-resource.openai.azure.com/openai/realtime?api-version=2024-12-17&deployment=gpt-4o-mini-realtime-preview-deployment-name
            base_host = self.azure_endpoint.replace('https://', '')
            websocket_url = f"wss://{base_host}/openai/realtime"
            
            # Add query parameters exactly as specified in docs
            params = {
                "api-version": self.api_version,
                "deployment": self.deployment_name
            }
            
            # Build full URL with parameters
            param_string = "&".join([f"{k}={v}" for k, v in params.items()])
            full_url = f"{websocket_url}?{param_string}"
            
            logger.info(f"Connecting to Azure WebSocket: {full_url}")
            logger.info(f"Using deployment: {self.deployment_name}")
            logger.info(f"Using API version: {self.api_version}")
            logger.info(f"Using direct API key authentication")
            
            # Try different API key authentication methods as specified in docs
            # Method 1: API key in header
            headers_apikey = {
                "api-key": self.api_key,
                "OpenAI-Beta": "realtime=v1"
            }
            
            # Method 2: API key as query parameter (fallback)
            full_url_with_apikey = f"{full_url}&api-key={self.api_key}"
            
            # Try connecting with API key in header first
            try:
                logger.info("Attempting connection with API key in header...")
                self.websocket = await asyncio.wait_for(
                    websockets.connect(full_url, extra_headers=headers_apikey),
                    timeout=30.0
                )
                self.is_connected = True
                self.start_time = time.time()
                
                # Configure the session after connection
                await self._configure_session(session_instructions)
                
                logger.info(f"✅ Successfully connected to Azure Realtime API with API key header")
                return True
                
            except Exception as e1:
                logger.warning(f"API key header connection failed: {e1}")
                
                # Try with API key as query parameter
                try:
                    logger.info("Attempting connection with API key as query parameter...")
                    self.websocket = await asyncio.wait_for(
                        websockets.connect(full_url_with_apikey, extra_headers={"OpenAI-Beta": "realtime=v1"}),
                        timeout=30.0
                    )
                    self.is_connected = True
                    self.start_time = time.time()
                    
                    # Configure the session after connection
                    await self._configure_session(session_instructions)
                    
                    logger.info(f"✅ Successfully connected to Azure Realtime API with API key query param")
                    return True
                    
                except websockets.exceptions.InvalidStatusCode as e2:
                    logger.error(f"❌ Azure WebSocket invalid status code: {e2.status_code}")
                    if hasattr(e2, 'response_headers'):
                        logger.error(f"Response headers: {e2.response_headers}")
                    if e2.status_code == 401:
                        logger.error("Authentication failed - check API key")
                    elif e2.status_code == 404:
                        logger.error("Endpoint not found - check URL format and deployment name")
                    elif e2.status_code == 403:
                        logger.error("Forbidden - check permissions and region")
                    return False
                except websockets.exceptions.ConnectionClosedError as e2:
                    logger.error(f"❌ Azure WebSocket connection closed: {e2.code} - {e2.reason}")
                    return False
                except Exception as e2:
                    logger.error(f"❌ All connection methods failed. Last error: {e2}")
                    return False
                
        except asyncio.TimeoutError:
            logger.error("❌ Azure connection timeout after 30 seconds")
            logger.error("This might indicate network issues or incorrect endpoint")
            self.is_connected = False
            return False
        except Exception as e:
            logger.error(f"❌ Failed to connect to Azure Realtime API: {e}")
            logger.error(f"Endpoint: {self.azure_endpoint}")
            logger.error(f"Deployment: {self.deployment_name}")
            self.is_connected = False
            return False
    
    async def _configure_session(self, instructions: str):
        """
        Configure the Azure session with interview-specific settings after connection
        """
        config = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": instructions,
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1"
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.3,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500
                },
                "tools": [],
                "tool_choice": "auto",
                "temperature": 0.7,
                "max_response_output_tokens": 450
            }
        }
        
        await self.websocket.send(json.dumps(config))
        logger.info("Sent session configuration update to Azure OpenAI")
    
    async def send_audio_chunk(self, audio_data: bytes):
        """
        Send audio chunk to Azure OpenAI
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
            
        # Convert audio data to base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        event = {
            "type": "input_audio_buffer.append",
            "audio": audio_base64
        }
        
        await self.websocket.send(json.dumps(event))
    
    async def commit_audio_and_respond(self):
        """
        Commit the audio buffer and request a response
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
            
        # Commit audio buffer
        commit_event = {
            "type": "input_audio_buffer.commit"
        }
        await self.websocket.send(json.dumps(commit_event))
        
        # Request response
        response_event = {
            "type": "response.create",
            "response": {
                "modalities": ["text", "audio"],
                "instructions": "Provide a thoughtful response to the candidate's answer and ask a relevant follow-up question."
            }
        }
        await self.websocket.send(json.dumps(response_event))
    
    async def send_text_message(self, text: str, role: str = "user"):
        """
        Send a text message to the conversation
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
            
        event = {
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": role,
                "content": [
                    {
                        "type": "input_text",
                        "text": text
                    }
                ]
            }
        }
        
        await self.websocket.send(json.dumps(event))
    
    async def request_response(self, instructions: Optional[str] = None):
        """
        Request a response from the AI
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
            
        response_event = {
            "type": "response.create",
            "response": {
                "modalities": ["text", "audio"]
            }
        }
        
        if instructions:
            response_event["response"]["instructions"] = instructions
            
        await self.websocket.send(json.dumps(response_event))
    
    async def listen_for_responses(self, message_handler: Callable):
        """
        Listen for responses from Azure OpenAI and handle them
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
            
        try:
            async for message in self.websocket:
                data = json.loads(message)
                await message_handler(data)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("Azure WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"Error listening for Azure responses: {e}")
            self.is_connected = False
            raise
    
    def is_connection_expired(self) -> bool:
        """
        Check if connection has exceeded maximum allowed time (billing protection)
        """
        if not self.start_time:
            return False
        return (time.time() - self.start_time) > self.connection_timeout
    
    async def disconnect(self):
        """
        Disconnect from Azure Realtime API with proper cleanup
        """
        if self.websocket:
            try:
                # Send session end signal before closing
                if self.is_connected:
                    end_session_event = {
                        "type": "session.update",
                        "session": {
                            "modalities": []  # Clear modalities to signal end
                        }
                    }
                    await self.websocket.send(json.dumps(end_session_event))
                    
                # Properly close WebSocket connection
                await self.websocket.close()
                logger.info("Azure WebSocket properly closed")
            except Exception as e:
                logger.warning(f"Error during Azure disconnect: {e}")
            finally:
                self.websocket = None
                self.is_connected = False
                logger.info("Disconnected from Azure Realtime API")


class AzureInterviewManager:
    """
    Interview manager specifically for Azure OpenAI Realtime API with live transcription
    """
    
    def __init__(self, session_id: str, job_description: str, resume_text: str, candidate_name: str, interview_id: str = None):
        self.session_id = session_id
        self.interview_id = interview_id  # Database interview schedule ID
        self.job_description = job_description
        self.resume_text = resume_text
        self.candidate_name = candidate_name
        self.audio_handler = None
        self.client_websocket = None
        self.is_active = False
        
        # Azure configuration from environment
        self.azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        self.azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        self.azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-17")
        
        # Validate Azure configuration
        if not all([self.azure_endpoint, self.azure_api_key, self.azure_deployment]):
            raise ValueError("Missing required Azure OpenAI configuration. Please check your .env file.")
        
        # Live transcription storage
        self.live_transcript = []
        self.last_db_push = time.time()
        self.transcription_buffer = []
        self.push_interval = 10  # Push to DB every 10 seconds
        self.transcription_task = None
        
        # Conversation tracking
        self.conversation_history = []
        self.transcript = []  # For API compatibility
        self.current_user_speech = ""
        self.current_ai_response = ""
        
        # Connection monitoring for billing protection
        self.connection_monitor_task = None
    
    def add_to_transcript(self, speaker: str, content: str, message_type: str = "text"):
        """Add entry to live transcript with timestamp"""
        timestamp = datetime.now().isoformat()
        transcript_entry = {
            "timestamp": timestamp,
            "speaker": speaker,  # "user", "assistant", "system"
            "content": content,
            "type": message_type,  # "text", "audio", "system"
            "session_id": self.session_id
        }
        
        self.live_transcript.append(transcript_entry)
        self.transcription_buffer.append(transcript_entry)
        
        # Also add to transcript for API compatibility
        self.transcript.append({
            "type": speaker,
            "content": content,
            "timestamp": timestamp
        })
        
        logger.info(f"Added to transcript - {speaker}: {content[:100]}...")
    
    async def start_transcription_sync(self):
        """Start background task to sync transcription to database every 10 seconds"""
        # Only start if we have a database interview_id
        if not self.interview_id:
            logger.info("No interview_id provided - skipping database transcription sync")
            return
            
        async def sync_transcription():
            while self.is_active:
                try:
                    await asyncio.sleep(self.push_interval)
                    if self.transcription_buffer and self.interview_id:
                        await self.push_transcription_to_db()
                except Exception as e:
                    logger.error(f"Error in transcription sync: {e}")
        
        self.transcription_task = asyncio.create_task(sync_transcription())
        logger.info("Started live transcription sync task")
    
    async def push_transcription_to_db(self):
        """Push buffered transcription entries to database"""
        if not self.transcription_buffer or not self.interview_id:
            return
        
        conn = get_db_connection()
        if not conn:
            logger.error("Failed to get database connection for transcription")
            return
        
        try:
            with conn.cursor() as cursor:
                # Get existing transcript
                cursor.execute(
                    "SELECT live_transcript FROM interview_schedules WHERE id = %s",
                    (self.interview_id,)
                )
                result = cursor.fetchone()
                
                if result:
                    existing_transcript = result['live_transcript'] or []
                    
                    # Append new entries
                    updated_transcript = existing_transcript + self.transcription_buffer
                    
                    # Update database
                    cursor.execute(
                        "UPDATE interview_schedules SET live_transcript = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                        (json.dumps(updated_transcript), self.interview_id)
                    )
                    conn.commit()
                    
                    logger.info(f"Pushed {len(self.transcription_buffer)} transcript entries to DB")
                    
                    # Clear buffer after successful push
                    self.transcription_buffer.clear()
                    self.last_db_push = time.time()
                    
        except Exception as e:
            logger.error(f"Error pushing transcription to database: {e}")
        finally:
            conn.close()
    
    async def stop_transcription_sync(self):
        """Stop transcription sync task and do final push"""
        if self.transcription_task:
            try:
                self.transcription_task.cancel()
                await self.transcription_task
            except asyncio.CancelledError:
                logger.info("Transcription sync task cancelled successfully")
            except Exception as e:
                logger.error(f"Error cancelling transcription task: {e}")
            finally:
                self.transcription_task = None
            
        # Final push of any remaining buffer (only if we have an interview_id)
        if self.transcription_buffer and self.interview_id:
            try:
                await self.push_transcription_to_db()
            except Exception as e:
                logger.error(f"Error in final transcription push: {e}")
    
    def create_interview_prompt(self) -> str:
        """
        Create a comprehensive interview prompt with professional system instructions
        """
        return f"""You are an AI Interviewer conducting a professional, human-like interview. 
You will be provided with a resume, a job description (JD), and company details. 
Your role is to simulate a realistic recruiter-style interview.

CANDIDATE INFORMATION:
- Name: {self.candidate_name}
- Resume: {self.resume_text}

JOB DESCRIPTION:
{self.job_description}

COMPANY DETAILS:
Professional technology company focused on innovative solutions and career development.

### Flow & Rules:

1. **Introduction**
   - Greet the candidate warmly and introduce yourself as the AI Interviewer.
   - Briefly describe the company and its mission/industry.
   - Provide a short overview of the job description the candidate is applying for.
   - Explain the **interview format** clearly:
     Example: "We'll begin with a few questions about your background, 
     then move into technical/role-specific questions, followed by 
     behavioral/situational ones. At the end, you'll have time to ask questions."

2. **Questioning Style**
   - Ask **one question at a time** in a natural, conversational tone.
   - Base questions on both the **Resume** and **JD**.
   - Cover:
     - Technical competence (skills, tools, experience)
     - Behavioral fit (teamwork, leadership, adaptability)
     - Situational judgment (problem-solving, decision-making)

3. **Conversation Management**
   - Actively engage like a human interviewer: 
     acknowledge responses (e.g., "That's a great example," "Interesting, could you elaborate?").
   - If the candidate gives very short answers → encourage more detail.
   - If the candidate drifts off-topic or asks questions **not related to the interview**, 
     respond politely and redirect:
     - Example: "That's an interesting question, but let's stay focused on the interview for now. 
       We'll return to your questions at the end."

4. **Evaluation Focus**
   - Explore areas where candidate's skills match the job requirements.
   - Ask for concrete examples of achievements and challenges.
   - Assess problem-solving, communication, adaptability, and leadership.

5. **Closing**
   - Thank the candidate for their answers.
   - Summarize the session in a positive tone.
   - Invite the candidate to ask questions **related to the company or role**.
   - Conclude politely.

### Important Guidelines:
- Always remain professional, respectful, and encouraging.
- Keep the tone conversational and natural, not robotic.
- Never answer on behalf of the candidate.
- Always bring the candidate back politely if they go off-track.
- Do not discuss confidential HR matters (like salary, rejection, etc.) unless explicitly part of the scripted process.
- Maintain neutrality and fairness throughout.

Begin by greeting {self.candidate_name} and starting the interview process according to the flow above."""

    async def initialize_audio_handler(self, api_key: str = None) -> bool:
        """
        Initialize the Azure audio handler (api_key parameter ignored for Azure)
        """
        self.audio_handler = AzureRealtimeAudioHandler(
            azure_endpoint=self.azure_endpoint,
            api_key=self.azure_api_key,
            deployment_name=self.azure_deployment,
            api_version=self.azure_api_version
        )
        
        instructions = self.create_interview_prompt()
        return await self.audio_handler.connect(instructions)
    
    async def start_interview(self):
        """
        Start the interview conversation with live transcription and connection monitoring
        """
        if not self.audio_handler or not self.audio_handler.is_connected:
            raise Exception("Audio handler not initialized or connected")
            
        # Start transcription sync
        self.is_active = True
        await self.start_transcription_sync()
        
        # Start connection monitoring to prevent excessive billing
        await self.start_connection_monitoring()
        
        # Add interview start to transcript
        self.add_to_transcript("system", f"Interview started for {self.candidate_name}", "system")
        
        # Send initial greeting message
        greeting = f"Hello {self.candidate_name}! I'm ready to start the interview."
        await self.audio_handler.send_text_message(greeting, "user")
        await self.audio_handler.request_response(
            "Start the interview with a warm greeting and your first question."
        )
        
        logger.info(f"Azure interview started for session: {self.session_id}")
    
    async def start_connection_monitoring(self):
        """Start background task to monitor Azure connection and prevent excessive billing"""
        async def monitor_connection():
            while self.is_active:
                try:
                    await asyncio.sleep(60)  # Check every minute
                    
                    if self.audio_handler and self.audio_handler.is_connection_expired():
                        logger.warning(f"Azure connection expired for session {self.session_id}, auto-ending interview")
                        await self.end_interview()
                        break
                        
                except Exception as e:
                    logger.error(f"Error in connection monitoring: {e}")
        
        self.connection_monitor_task = asyncio.create_task(monitor_connection())
        logger.info("Started Azure connection monitoring for billing protection")
    
    async def handle_client_audio(self, audio_data: str):
        """
        Handle audio data from client
        """
        if not self.audio_handler or not self.audio_handler.is_connected:
            raise Exception("Audio handler not available")
            
        # Decode base64 audio data
        audio_bytes = base64.b64decode(audio_data)
        await self.audio_handler.send_audio_chunk(audio_bytes)
    
    async def commit_audio_and_respond(self):
        """
        Commit audio buffer and request AI response
        """
        if not self.audio_handler or not self.audio_handler.is_connected:
            raise Exception("Audio handler not available")
            
        await self.audio_handler.commit_audio_and_respond()
    
    async def handle_openai_message(self, message_data: dict):
        """
        Handle messages from Azure OpenAI and forward to client with transcription capture
        """
        if not self.client_websocket:
            return
            
        # Filter and forward relevant messages to client
        relevant_types = [
            "response.audio.delta",
            "response.audio.done", 
            "response.text.delta",
            "response.text.done",
            "conversation.item.created",
            "response.done",
            "input_audio_buffer.speech_started",
            "input_audio_buffer.speech_stopped",
            "response.created",
            "response.output_item.added",
            "response.output_item.done",
            "conversation.item.input_audio_transcription.completed",
            "conversation.item.input_audio_transcription.failed"
        ]
        
        if message_data.get("type") in relevant_types:
            try:
                await self.client_websocket.send_text(json.dumps(message_data))
                
                # Capture transcriptions for live storage
                message_type = message_data.get("type")
                
                # Capture user speech transcription
                if message_type == "conversation.item.input_audio_transcription.completed":
                    user_speech = message_data.get("transcript", "")
                    if user_speech.strip():
                        self.add_to_transcript("user", user_speech, "audio")
                        self.current_user_speech = user_speech
                
                # Capture AI text responses
                elif message_type == "response.text.done":
                    ai_response = message_data.get("text", "")
                    if ai_response.strip():
                        self.add_to_transcript("assistant", ai_response, "text")
                        self.current_ai_response = ai_response
                        
                        # Also log for conversation history
                        self.conversation_history.append({
                            "role": "assistant",
                            "content": ai_response,
                            "timestamp": asyncio.get_event_loop().time()
                        })
                
                # Capture when user starts/stops speaking
                elif message_type == "input_audio_buffer.speech_started":
                    self.add_to_transcript("system", "User started speaking", "system")
                elif message_type == "input_audio_buffer.speech_stopped":
                    self.add_to_transcript("system", "User stopped speaking", "system")
                
                # Capture when AI starts responding
                elif message_type == "response.created":
                    self.add_to_transcript("system", "AI started responding", "system")
                elif message_type == "response.done":
                    self.add_to_transcript("system", "AI finished responding", "system")
                    
            except Exception as e:
                logger.error(f"Error forwarding message to client: {e}")
    
    async def end_interview(self):
        """
        End the interview session with final transcription push and proper cleanup
        """
        if not self.is_active:
            logger.info(f"Interview already ended for session: {self.session_id}")
            return
            
        # Add interview end to transcript
        self.add_to_transcript("system", f"Interview ended for {self.candidate_name}", "system")
        
        # Stop transcription sync and do final push
        await self.stop_transcription_sync()
        
        # Stop connection monitoring
        if self.connection_monitor_task:
            try:
                self.connection_monitor_task.cancel()
                await self.connection_monitor_task
            except asyncio.CancelledError:
                logger.info("Connection monitoring task cancelled successfully")
            except Exception as e:
                logger.error(f"Error cancelling connection monitoring: {e}")
            finally:
                self.connection_monitor_task = None
        
        self.is_active = False
        
        # CRITICAL: Properly disconnect from Azure to prevent billing
        if self.audio_handler:
            try:
                await self.audio_handler.disconnect()
                logger.info("Azure Realtime API connection properly closed")
            except Exception as e:
                logger.error(f"Error disconnecting audio handler: {e}")
            finally:
                self.audio_handler = None  # Clear reference to prevent memory leaks
            
        logger.info(f"Azure interview ended for session: {self.session_id}")
        
        # Return conversation summary with transcription stats
        return {
            "session_id": self.session_id,
            "candidate_name": self.candidate_name,
            "conversation_length": len(self.conversation_history),
            "transcript_entries": len(self.live_transcript),
            "status": "completed"
        }
    
    def get_live_transcript(self):
        """Get the current live transcript"""
        return self.live_transcript.copy()
    
    def get_transcript_summary(self):
        """Get a summary of the current transcript"""
        user_messages = [entry for entry in self.live_transcript if entry["speaker"] == "user" and entry["type"] == "audio"]
        ai_messages = [entry for entry in self.live_transcript if entry["speaker"] == "assistant"]
        
        return {
            "total_entries": len(self.live_transcript),
            "user_speech_count": len(user_messages),
            "ai_response_count": len(ai_messages),
            "interview_duration_minutes": (time.time() - (self.live_transcript[0]["timestamp"] if self.live_transcript else time.time())) / 60
        }
