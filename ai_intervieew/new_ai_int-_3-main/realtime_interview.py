import asyncio
import json
import logging
import base64
import io
from typing import Optional, Callable
import websockets
import time
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
            password=os.getenv("DB_PASS", "5522"),
            port=int(os.getenv("DB_PORT", "6543")),
            cursor_factory=RealDictCursor
        )
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

class RealtimeAudioHandler:
    """
    Enhanced audio handler for OpenAI Realtime API integration with billing protection
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.session_config = None
        self.connection_timeout = 3600  # 1 hour max connection time
        self.start_time = None
        
    async def connect(self, session_instructions: str) -> bool:
        """
        Connect to OpenAI Realtime API with session configuration and timeout protection
        """
        url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1"
        }
        
        try:
            # Add connection timeout to prevent hanging connections
            self.websocket = await asyncio.wait_for(
                websockets.connect(url, extra_headers=headers), 
                timeout=30.0
            )
            self.is_connected = True
            self.start_time = time.time()
            
            # Configure the session
            await self._configure_session(session_instructions)
            
            logger.info("Successfully connected to OpenAI Realtime API with timeout protection")
            return True
            
        except asyncio.TimeoutError:
            logger.error("OpenAI connection timeout after 30 seconds")
            self.is_connected = False
            return False
        except Exception as e:
            logger.error(f"Failed to connect to OpenAI Realtime API: {e}")
            self.is_connected = False
            return False
    
    async def _configure_session(self, instructions: str):
        """
        Configure the OpenAI session with interview-specific settings
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
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500
                },
                "tools": [],
                "tool_choice": "auto",
                "temperature": 0.8,
                "max_response_output_tokens": 4096
            }
        }
        
        await self.websocket.send(json.dumps(config))
        self.session_config = config
        
    async def send_audio_chunk(self, audio_data: bytes):
        """
        Send audio chunk to OpenAI
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to OpenAI Realtime API")
            
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
            raise Exception("Not connected to OpenAI Realtime API")
            
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
            raise Exception("Not connected to OpenAI Realtime API")
            
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
            raise Exception("Not connected to OpenAI Realtime API")
            
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
        Listen for responses from OpenAI and handle them
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to OpenAI Realtime API")
            
        try:
            async for message in self.websocket:
                data = json.loads(message)
                await message_handler(data)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("OpenAI WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"Error listening for OpenAI responses: {e}")
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
        Disconnect from OpenAI Realtime API with proper cleanup
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
                logger.info("OpenAI WebSocket properly closed")
            except Exception as e:
                logger.warning(f"Error during OpenAI disconnect: {e}")
            finally:
                self.websocket = None
                self.is_connected = False
                logger.info("Disconnected from OpenAI Realtime API")


class InterviewManager:
    """
    Manages the interview process and audio streaming with live transcription storage
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
        
        # Live transcription storage
        self.live_transcript = []
        self.last_db_push = time.time()
        self.transcription_buffer = []
        self.push_interval = 10  # Push to DB every 10 seconds
        self.transcription_task = None
        
        # Conversation tracking
        self.conversation_history = []
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
        Create a comprehensive interview prompt
        """
        return f"""You are conducting a professional technical interview. Here are the details:

CANDIDATE INFORMATION:
- Name: {self.candidate_name}
- Resume: {self.resume_text}

JOB REQUIREMENTS:
{self.job_description}

INTERVIEW GUIDELINES:
1. Conduct a comprehensive technical interview (20-30 minutes)
2. Ask questions that directly relate to the job requirements
3. Evaluate both technical skills and cultural fit
4. Be conversational and engaging while maintaining professionalism
5. Ask follow-up questions based on candidate responses
6. Provide constructive feedback when appropriate
7. Cover these areas as relevant:
   - Technical skills and experience
   - Problem-solving approach
   - Past project experiences
   - Behavioral/situational questions
   - Questions about the role and company

INTERVIEW STRUCTURE:
1. Start with a warm greeting and brief introduction
2. Ask about their background and interest in the role
3. Progress to technical questions based on job requirements
4. Include 2-3 behavioral questions
5. Allow time for candidate questions
6. Conclude with next steps

Begin by greeting {self.candidate_name} and starting the interview process."""

    async def initialize_audio_handler(self, api_key: str) -> bool:
        """
        Initialize the audio handler with OpenAI connection
        """
        self.audio_handler = RealtimeAudioHandler(api_key)
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
        
        logger.info(f"Interview started for session: {self.session_id}")
    
    async def start_connection_monitoring(self):
        """Start background task to monitor OpenAI connection and prevent excessive billing"""
        async def monitor_connection():
            while self.is_active:
                try:
                    await asyncio.sleep(60)  # Check every minute
                    
                    if self.audio_handler and self.audio_handler.is_connection_expired():
                        logger.warning(f"OpenAI connection expired for session {self.session_id}, auto-ending interview")
                        await self.end_interview()
                        break
                        
                except Exception as e:
                    logger.error(f"Error in connection monitoring: {e}")
        
        self.connection_monitor_task = asyncio.create_task(monitor_connection())
        logger.info("Started connection monitoring for billing protection")
    
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
        Handle messages from OpenAI and forward to client with transcription capture
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
        
        # CRITICAL: Properly disconnect from OpenAI to prevent billing
        if self.audio_handler:
            try:
                await self.audio_handler.disconnect()
                logger.info("OpenAI Realtime API connection properly closed")
            except Exception as e:
                logger.error(f"Error disconnecting audio handler: {e}")
            finally:
                self.audio_handler = None  # Clear reference to prevent memory leaks
            
        logger.info(f"Interview ended for session: {self.session_id}")
        
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
