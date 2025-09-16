import asyncio
import json
import logging
import base64
import time
from typing import Optional, Callable
import websockets
import httpx
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Database configuration using Supabase REST API
import httpx

async def save_to_supabase(endpoint: str, data: dict) -> dict:
    """Save data to Supabase using REST API"""
    try:
        supabase_url = os.getenv("SUPABASE_URL", "https://lmzzskcneufwglycfdov.supabase.co")
        service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
        
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{supabase_url}/rest/v1/{endpoint}",
                json=data,
                headers=headers,
                timeout=30.0
            )
            
            if not response.is_success:
                # Log the response body for 400 errors
                try:
                    error_text = response.text
                    logger.error(f"Supabase POST {endpoint} failed: {response.status_code} - {error_text}")
                except:
                    logger.error(f"Supabase POST {endpoint} failed: {response.status_code} - unable to read response body")
                response.raise_for_status()
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Supabase save error to {endpoint}: {e}")
        raise

async def update_supabase(endpoint: str, data: dict, eq_field: str, eq_value: str) -> dict:
    """Update data in Supabase using REST API"""
    try:
        supabase_url = os.getenv("SUPABASE_URL", "https://lmzzskcneufwglycfdov.supabase.co")
        service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
        
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        url = f"{supabase_url}/rest/v1/{endpoint}?{eq_field}=eq.{eq_value}"
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                url,
                json=data,
                headers=headers,
                timeout=30.0
            )
            
            if not response.is_success:
                # Log the response body for 400 errors
                try:
                    error_text = response.text
                    logger.error(f"Supabase PATCH {url} failed: {response.status_code} - {error_text}")
                except:
                    logger.error(f"Supabase PATCH {url} failed: {response.status_code} - unable to read response body")
                response.raise_for_status()
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Supabase update error to {endpoint}: {e}")
        raise

class AzureRealtimeAudioHandler:
    """
    Azure OpenAI Realtime API handler with ephemeral key authentication and billing protection
    """
    
    def __init__(self, azure_endpoint: str, api_key: str, deployment_name: str, api_version: str = "2024-12-17"):
        # Normalize the endpoint URL
        self.azure_endpoint = azure_endpoint.rstrip('/')
        if not self.azure_endpoint.startswith(('http://', 'https://')):
            self.azure_endpoint = f"https://{self.azure_endpoint}"
        
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
        
        # Function call tracking for AI-initiated actions
        self.interview_end_requested = False
        self.interview_end_reason = ""
        self.interview_end_summary = ""
        
        # Meeting agenda system (session-based, not database)
        self.meeting_agenda = None
        self.current_topic_index = 0
        self.completed_topics = []
        self.agenda_created = False
        
        # Question tracking for fair assessment
        self.questions_asked_per_module = {}  # Track what questions were actually asked
        self.module_coverage_tracking = {}    # Track how well each module was covered
        
        # Prompt reinforcement system to prevent AI forgetting
        self.original_instructions = None
        self.last_prompt_refresh = None
        self.prompt_refresh_interval = 180  # Refresh prompt every 3 minutes
        self.response_count = 0
        self.reinforce_every_n_responses = 5  # Reinforce instructions every 5 responses
        
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
    
    async def create_meeting_agenda(self, job_description: str, resume_text: str, candidate_name: str, interview_duration: int = 30) -> dict:
        """
        Create a detailed modular meeting agenda using ProxyLLM
        """
        try:
            agenda_prompt = f"""
You are a senior technical recruiter creating an interview agenda that will thoroughly evaluate this candidate's capabilities through deep, probing questions.

CANDIDATE: {candidate_name}
RESUME: {resume_text}
JOB DESCRIPTION: {job_description}
INTERVIEW DURATION: {interview_duration} minutes

Create a structured interview agenda that focuses on DEPTH over breadth. The goal is to ask challenging, insightful questions that reveal the candidate's true capabilities, problem-solving skills, and potential.

INTERVIEW APPROACH:
- Ask open-ended questions that require detailed explanations
- Include scenario-based questions relevant to the role
- Challenge the candidate with "What if" and "How would you" scenarios
- Probe for specific examples and concrete evidence
- Test both technical depth and soft skills
- Create questions that build on the candidate's actual experience

TIME ALLOCATION (Total: {interview_duration} minutes):
- Introduction & Rapport: 10-15% of time
- Technical/Experience Deep Dive: 50-60% of time  
- Behavioral/Problem-solving: 20-25% of time
- Role-specific Assessment: 10-15% of time
- Candidate Questions & Closing: 5-10% of time

For each module, create questions that:
1. Start broad then drill down into specifics
2. Ask for concrete examples: "Walk me through a time when..."
3. Challenge assumptions: "What would you do if that approach failed?"
4. Test problem-solving: "How would you debug/solve/approach..."
5. Explore thought processes: "What was your reasoning behind..."

Return ONLY a JSON object:
{{
    "total_duration_minutes": {interview_duration},
    "modules": [
        {{
            "id": 1,
            "title": "Introduction & Rapport Building",
            "duration_minutes": [calculated proportionally],
            "objectives": ["Build rapport", "Understand motivation", "Set comfortable tone"],
            "key_questions": [
                "Tell me what drew you to apply for this specific role",
                "What's the most interesting project you've worked on recently?",
                "What are you looking for in your next career move?"
            ],
            "evaluation_criteria": ["Communication clarity", "Genuine enthusiasm", "Career focus"],
            "transition_note": "That's great background. Now I'd love to dive deeper into your technical experience..."
        }}
    ]
}}

CRITICAL: Create questions that are:
- Specific to the candidate's background and the role requirements
- Designed to uncover depth, not just surface knowledge
- Challenging enough to differentiate between candidates
- Open-ended to encourage detailed responses
- Progressive (building complexity as the interview continues)

Make sure all module durations sum to exactly {interview_duration} minutes.
"""

            # Get ProxyLLM configuration from environment
            proxyllm_url = os.getenv("PROXYLLM_URL", "https://proxyllm.ximplify.id/v1/chat/completions")
            proxyllm_key = os.getenv("PROXYLLM_KEY", "sk-CxXh7gykTHvf9Vvi3x9Ehg")
            proxyllm_model = os.getenv("PROXYLLM_MODEL", "azure/gpt-4.1")

            # Call ProxyLLM to generate agenda
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    proxyllm_url,
                    headers={
                        "Authorization": f"Bearer {proxyllm_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": proxyllm_model,
                        "messages": [{"role": "user", "content": agenda_prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.7
                    },
                    timeout=80.0
                )
                response.raise_for_status()
                
                agenda_json = response.json()["choices"][0]["message"]["content"]
                agenda_data = json.loads(agenda_json)
                
                logger.info(f"✅ Created meeting agenda with {len(agenda_data.get('modules', []))} modules")
                return agenda_data
                
        except Exception as e:
            logger.error(f"❌ Error creating meeting agenda: {e}")
            # Return fallback agenda proportional to interview duration
            if interview_duration <= 20:
                # Short interview - focus on essentials
                return {
                    "total_duration_minutes": interview_duration,
                    "modules": [
                        {
                            "id": 1,
                            "title": "Introduction",
                            "duration_minutes": max(2, interview_duration // 6),
                            "objectives": ["Welcome candidate", "Set expectations"],
                            "key_questions": ["Tell me about yourself", "Why are you interested in this role?"],
                            "evaluation_criteria": ["Communication skills", "Interest level"],
                            "transition_note": "Great! Now let's talk about your experience..."
                        },
                        {
                            "id": 2,
                            "title": "Experience & Skills Review",
                            "duration_minutes": max(8, interview_duration // 2),
                            "objectives": ["Understand background", "Assess relevant skills"],
                            "key_questions": ["Walk me through your key experience", "What's your strongest skill?"],
                            "evaluation_criteria": ["Technical depth", "Relevance to role"],
                            "transition_note": "Let's wrap up with any questions you have..."
                        },
                        {
                            "id": 3,
                            "title": "Questions & Closing",
                            "duration_minutes": interview_duration - max(2, interview_duration // 6) - max(8, interview_duration // 2),
                            "objectives": ["Answer questions", "Close professionally"],
                            "key_questions": ["What questions do you have?", "What interests you most about this role?"],
                            "evaluation_criteria": ["Genuine interest", "Thoughtful questions"],
                            "transition_note": "Thank you for your time today..."
                        }
                    ]
                }
            else:
                # Standard or longer interview
                intro_time = max(3, interview_duration // 10)
                experience_time = max(6, interview_duration // 4)
                technical_time = max(8, interview_duration // 3)
                behavioral_time = max(4, interview_duration // 6)
                closing_time = interview_duration - intro_time - experience_time - technical_time - behavioral_time
                
                return {
                    "total_duration_minutes": interview_duration,
                    "modules": [
                        {
                            "id": 1,
                            "title": "Introduction",
                            "duration_minutes": intro_time,
                            "objectives": ["Welcome candidate", "Set expectations"],
                            "key_questions": ["Tell me about yourself", "Why are you interested in this role?"],
                            "evaluation_criteria": ["Communication skills", "Interest level"],
                            "transition_note": "Great! Now let's talk about your experience..."
                        },
                        {
                            "id": 2,
                            "title": "Experience Review",
                            "duration_minutes": experience_time,
                            "objectives": ["Understand background", "Assess relevant experience"],
                            "key_questions": ["Walk me through your recent projects", "What challenges have you faced?"],
                            "evaluation_criteria": ["Technical depth", "Problem-solving approach"],
                            "transition_note": "Let's dive deeper into technical skills..."
                        },
                        {
                            "id": 3,
                            "title": "Technical Assessment",
                            "duration_minutes": technical_time,
                            "objectives": ["Evaluate technical skills", "Test knowledge depth"],
                            "key_questions": ["Explain your technical approach", "How would you solve this problem?"],
                            "evaluation_criteria": ["Technical accuracy", "Problem-solving methodology"],
                            "transition_note": "Now I'd like to understand how you work with teams..."
                        },
                        {
                            "id": 4,
                            "title": "Behavioral Questions",
                            "duration_minutes": behavioral_time,
                            "objectives": ["Assess soft skills", "Understand work style"],
                            "key_questions": ["Tell me about a team conflict", "Describe a leadership situation"],
                            "evaluation_criteria": ["Teamwork", "Leadership potential"],
                            "transition_note": "Finally, let's talk about this specific role..."
                        },
                        {
                            "id": 5,
                            "title": "Role-Specific & Closing",
                            "duration_minutes": closing_time,
                            "objectives": ["Role alignment", "Answer questions"],
                            "key_questions": ["Why this company?", "What questions do you have?"],
                            "evaluation_criteria": ["Cultural fit", "Genuine interest"],
                            "transition_note": "Thank you for your time today..."
                        }
                    ]
                }
    
    def log_module_status(self):
        """Log current module progress and coverage tracking"""
        if not self.meeting_agenda:
            logger.warning("📊 No meeting agenda available for module tracking")
            return
            
        modules = self.meeting_agenda.get("modules", [])
        if not modules:
            logger.warning("📊 No modules found in meeting agenda")
            return
            
        total_modules = len(modules)
        current_idx = self.current_topic_index
        
        logger.info(f"📊 MODULE PROGRESS: {current_idx + 1}/{total_modules}")
        
        # Log current module
        if current_idx < total_modules:
            current_module = modules[current_idx]
            logger.info(f"📌 Current Module: {current_module.get('title', 'Unknown')}")
            logger.info(f"⏱️  Duration: {current_module.get('duration_minutes', 'N/A')} minutes")
        
        # Log completed modules
        if self.completed_topics:
            completed_titles = [topic.get("title", f"Module {i}") for i, topic in enumerate(self.completed_topics)]
            logger.info(f"✅ Completed Modules: {', '.join(completed_titles)}")
        
        # Log remaining modules
        remaining_modules = modules[current_idx + 1:] if current_idx < total_modules - 1 else []
        if remaining_modules:
            remaining_titles = [mod.get('title', f'Module {current_idx + 1 + idx}') for idx, mod in enumerate(remaining_modules)]
            logger.info(f"⏳ Remaining Modules: {', '.join(remaining_titles)}")
        
        # Log questions asked tracking
        if hasattr(self, 'questions_asked_per_module') and self.questions_asked_per_module:
            logger.info("📋 Questions Asked Per Module:")
            for module_id, data in self.questions_asked_per_module.items():
                questions_count = data.get('questions_count', 0)
                module_title = data.get('module_title', f'Module {module_id}')
                logger.info(f"   {module_title}: {questions_count} questions")
        
        # Check for modules not assessed yet
        unassessed_modules = []
        for module_idx, module in enumerate(modules):
            module_id = module.get("id", module_idx)
            if not hasattr(self, 'questions_asked_per_module') or module_id not in self.questions_asked_per_module:
                unassessed_modules.append(module.get("title", f"Module {module_idx}"))
        
        if unassessed_modules:
            logger.warning(f"⚠️  Modules Not Yet Assessed: {', '.join(unassessed_modules)}")
    
    def ensure_all_modules_covered(self):
        """Ensure all 5 core modules are represented in the agenda"""
        if not self.meeting_agenda:
            return
            
        modules = self.meeting_agenda.get("modules", [])
        core_module_types = ["Introduction", "Technical", "Behavioural", "Role-Specific", "Closing"]
        
        logger.info("🎯 Verifying Core Module Coverage:")
        for core_type in core_module_types:
            found = any(core_type.lower() in module.get("title", "").lower() for module in modules)
            status = "✅" if found else "❌"
            logger.info(f"   {status} {core_type} Module")
        
        if len(modules) >= 5:
            logger.info(f"✅ Interview has {len(modules)} modules (minimum 5 core modules covered)")
        else:
            logger.warning(f"⚠️  Interview only has {len(modules)} modules (recommended: 5+)")

    async def connect_azure_realtime(self, session_instructions: str) -> bool:
        """
        Connect to Azure OpenAI Realtime API using websockets library with proper header handling
        """
        try:
            # Build websocket URL from environment variables
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", self.azure_endpoint)
            deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", self.deployment_name)
            api_version = os.getenv("AZURE_OPENAI_API_VERSION", self.api_version)
            api_key = os.getenv("AZURE_OPENAI_API_KEY", self.api_key)
            
            # Construct WebSocket URL according to Microsoft docs
            base_host = azure_endpoint.replace('https://', '').replace('http://', '')
            websocket_url = f"wss://{base_host}/openai/realtime"
            
            # Add query parameters
            params = {
                "api-version": api_version,
                "deployment": deployment_name
            }
            
            # Build full URL with parameters
            param_string = "&".join([f"{k}={v}" for k, v in params.items()])
            full_url = f"{websocket_url}?{param_string}"
            
            logger.info(f"🔌 Connecting to Azure WebSocket: {full_url}")
            logger.info(f"📦 Using deployment: {deployment_name}")
            logger.info(f"📅 Using API version: {api_version}")
            logger.info(f"🔑 Using websockets library with API key authentication")
            
            # Headers for authentication - use both headers as required by this project's Azure setup
            headers = {
                "api-key": api_key,
                "Authorization": f"Bearer {api_key}",
                "OpenAI-Beta": "realtime=v1"
            }
            
            # Connect using websockets library with proper header format
            try:
                logger.info("🚀 Attempting WebSocket connection with websockets library...")
                logger.info(f"🎯 Headers: {headers}")
                
                # Use the correct API for websockets 12.0+
                self.websocket = await asyncio.wait_for(
                    websockets.connect(
                        full_url,
                        additional_headers=headers,  # Changed from extra_headers to additional_headers
                        ping_interval=30,
                        ping_timeout=10,
                        max_size=2**20,  # 1MB max message size
                        compression=None
                    ),
                    timeout=45.0  # Increased timeout slightly but keep project settings
                )
                
                self.is_connected = True
                self.start_time = time.time()
                
                logger.info(f"✅ Successfully connected to Azure Realtime API")
                
                # Wait a moment for connection to stabilize
                await asyncio.sleep(0.5)
                
                # Configure the session after connection (Azure doesn't need session.start)
                await self._configure_session(session_instructions)
                
                return True
                
            except asyncio.TimeoutError:
                logger.error("❌ Azure connection timeout after 45 seconds")
                logger.error("💡 Project-specific troubleshooting:")
                logger.error(f"   1. Verify deployment '{deployment_name}' exists in Azure resource")
                logger.error(f"   2. Check if endpoint '{azure_endpoint}' is accessible")
                logger.error(f"   3. Ensure API version '{api_version}' is supported")
                logger.error("   4. Verify network connectivity to Azure OpenAI service")
                return False
                
            except websockets.InvalidStatusCode as e:
                logger.error(f"❌ Azure WebSocket status code error: {e.status_code}")
                if hasattr(e, 'response_headers'):
                    logger.error(f"Response headers: {dict(e.response_headers)}")
                
                if e.status_code == 400:
                    logger.error("Bad Request - check API version, deployment name, and headers")
                elif e.status_code == 401:
                    logger.error("Authentication failed - check API key")
                elif e.status_code == 404:
                    logger.error("Endpoint not found - check URL format and deployment name")
                elif e.status_code == 403:
                    logger.error("Forbidden - check permissions and region")
                
                return False
                
            except websockets.ConnectionClosed as e:
                logger.error(f"❌ Azure WebSocket connection closed: {e.code} - {e.reason}")
                return False
                
            except Exception as e:
                logger.error(f"❌ Unexpected error connecting to Azure: {e}")
                logger.error(f"Error type: {type(e).__name__}")
                logger.error(f"Endpoint: {azure_endpoint}")
                logger.error(f"Deployment: {deployment_name}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to connect to Azure Realtime API: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            self.is_connected = False
            return False

    async def _send_session_start(self):
        """Send session start message to Azure Realtime API"""
        try:
            start_message = {"type": "session.start"}
            await self.websocket.send(json.dumps(start_message))
            logger.info("📤 Sent session.start message to Azure Realtime")
        except Exception as e:
            logger.error(f"❌ Failed to send session.start: {e}")

    async def connect(self, session_instructions: str) -> bool:
        """Legacy connect method - redirects to new connect_azure_realtime"""
        return await self.connect_azure_realtime(session_instructions)
    
    async def _cleanup_session(self):
        """Clean up websocket connection"""
        try:
            if self.websocket and not getattr(self.websocket, 'closed', True):
                await self.websocket.close()
            self.websocket = None
        except Exception as e:
            logger.warning(f"Error cleaning up websocket: {e}")
    
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
                "tools": [
                    {
                        "type": "function",
                        "name": "end_interview",
                        "description": "End the interview session when the interview is complete. Call this when you have finished asking all necessary questions and are ready to conclude the interview.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "reason": {
                                    "type": "string",
                                    "description": "Brief reason for ending the interview (e.g., 'Interview completed successfully', 'All questions covered')"
                                },
                                "summary": {
                                    "type": "string", 
                                    "description": "Brief summary of the interview outcome"
                                }
                            },
                            "required": ["reason"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "mark_topic_complete",
                        "description": "Mark the current topic as completed and move to the next topic in the meeting agenda. Use this when you have thoroughly covered the current topic and are ready to proceed.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "topic_summary": {
                                    "type": "string",
                                    "description": "Brief summary of what was covered in this topic"
                                },
                                "candidate_performance": {
                                    "type": "string",
                                    "description": "Brief assessment of candidate's performance on this topic (Good/Average/Needs Improvement)"
                                }
                            },
                            "required": ["topic_summary"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "get_current_agenda",
                        "description": "Get the current meeting agenda with progress status. Use this to check what topics are remaining and current progress.",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    },
                    {
                        "type": "function",
                        "name": "get_time_status",
                        "description": "Get the current interview time status including elapsed time, remaining time, and duration information.",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    }
                ],
                "tool_choice": "auto",
                "temperature": 0.7,
                "max_response_output_tokens": 3000
            }
        }
        
        await self.websocket.send(json.dumps(config))
        logger.info("✅ Sent session configuration update to Azure OpenAI")
        
        # Store original instructions for periodic refresh
        self.original_instructions = instructions
        self.last_prompt_refresh = time.time()
        logger.info(f"🔄 System prompt stored for reinforcement (length: {len(instructions)} chars)")
        logger.info(f"⏰ Prompt refresh interval: {self.prompt_refresh_interval} seconds")
        logger.info(f"🔢 Response-count reinforcement every: {self.reinforce_every_n_responses} responses")
    
    async def disable_functions_for_greeting(self):
        """Temporarily disable function calls for greeting phase"""
        if not self.is_connected or not self.websocket:
            return
        
        config = {
            "type": "session.update",
            "session": {
                "tools": [],  # No tools during greeting
                "tool_choice": "none"  # Explicitly disable function calls
            }
        }
        
        await self.websocket.send(json.dumps(config))
        logger.info("🚫 Disabled functions for greeting phase")
    
    async def enable_functions_after_greeting(self):
        """Re-enable function calls after greeting phase"""
        if not self.is_connected or not self.websocket:
            return
        
        # Re-enable all functions
        config = {
            "type": "session.update", 
            "session": {
                "tools": [
                    {
                        "type": "function",
                        "name": "end_interview",
                        "description": "End the interview session when the interview is complete. Call this when you have finished asking all necessary questions and are ready to conclude the interview.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "reason": {
                                    "type": "string",
                                    "description": "Brief reason for ending the interview (e.g., 'Interview completed successfully', 'All questions covered')"
                                },
                                "summary": {
                                    "type": "string", 
                                    "description": "Brief summary of the interview outcome"
                                }
                            },
                            "required": ["reason"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "mark_topic_complete",
                        "description": "Mark the current interview topic/module as complete and move to the next one. Use this when you have gathered sufficient information about the current topic.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "topic_summary": {
                                    "type": "string",
                                    "description": "Brief summary of what was discussed in this topic"
                                },
                                "candidate_performance": {
                                    "type": "string",
                                    "enum": ["Excellent", "Good", "Average", "Below Average", "Poor"],
                                    "description": "Assessment of candidate's performance in this topic"
                                }
                            },
                            "required": ["topic_summary", "candidate_performance"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "get_current_agenda",
                        "description": "Get the current meeting agenda with progress status. Use this to check what topics are remaining and current progress.",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    },
                    {
                        "type": "function",
                        "name": "get_time_status",
                        "description": "Get current interview time status and remaining time. Use this to manage pacing and ensure interview completion within allocated time.",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    }
                ],
                "tool_choice": "auto"
            }
        }
        
        await self.websocket.send(json.dumps(config))
        logger.info("✅ Re-enabled functions after greeting phase")
    
    async def _refresh_system_prompt(self):
        """
        Refresh the system prompt to prevent AI from forgetting core instructions
        """
        if not self.original_instructions or not self.is_connected or not self.websocket:
            logger.warning("❌ Cannot refresh system prompt - missing instructions, connection, or websocket")
            return
            
        try:
            # Create context-aware instructions that include agenda progress
            enhanced_instructions = self._create_context_enhanced_instructions()
            
            refresh_config = {
                "type": "session.update",
                "session": {
                    "instructions": enhanced_instructions,
                    "temperature": 0.7
                }
            }
            
            await self.websocket.send(json.dumps(refresh_config))
            self.last_prompt_refresh = time.time()
            logger.info("🔄 Successfully refreshed system prompt with current agenda context")
            
        except Exception as e:
            logger.error(f"❌ Error refreshing system prompt: {e}")
    
    def _create_context_enhanced_instructions(self) -> str:
        """
        Create enhanced instructions that include interview progress context and time awareness
        """
        base_instructions = self.original_instructions or ""
        
        # If no meeting agenda, return original instructions
        if not self.meeting_agenda:
            return base_instructions
        
        # Build professional context
        modules = self.meeting_agenda.get("modules", [])
        current_index = self.current_topic_index
        completed_topics = self.completed_topics
        
        # Get time information from interview manager if available
        time_context = ""
        if hasattr(self, 'interview_manager_ref') and self.interview_manager_ref:
            mgr = self.interview_manager_ref
            if mgr.interview_start_time:
                elapsed = mgr.get_elapsed_interview_time()
                remaining = mgr.get_remaining_interview_time()
                percentage = (elapsed / mgr.interview_duration) * 100
                
                time_context = f"""
⏰ INTERVIEW TIMING:
Total Duration: {mgr.interview_duration} minutes
Elapsed: {elapsed:.1f} minutes ({percentage:.0f}% complete)
Remaining: {remaining:.1f} minutes

TIME MANAGEMENT: {"You're running ahead of schedule - feel free to explore topics in more depth." if percentage < 70 else "You're on track - maintain good pacing." if percentage < 85 else "Time is getting limited - focus on key assessment areas and prepare to wrap up soon."}

"""
        
        # Create professional interview context
        interview_context = f"""{time_context}
INTERVIEW PROGRESS CONTEXT:
You are conducting a structured interview with {len(modules)} key assessment areas. You have completed {len(completed_topics)} areas and are currently focusing on area {current_index + 1}.

"""
        
        # Add current focus without revealing internal mechanics
        if current_index < len(modules):
            current_module = modules[current_index]
            interview_context += f"""CURRENT FOCUS AREA: {current_module['title']}
Key areas to explore: {', '.join(current_module.get('objectives', []))}
Allocated time for this area: {current_module.get('duration_minutes', 'N/A')} minutes

"""
        
        # Add completed areas summary
        if completed_topics:
            completed_areas = [f"{topic['title']}" for topic in completed_topics]
            interview_context += f"""AREAS ALREADY COVERED: {', '.join(completed_areas)}

"""
        
        # Add remaining areas
        remaining_modules = modules[current_index + 1:] if current_index < len(modules) else []
        if remaining_modules:
            remaining_areas = [module['title'] for module in remaining_modules[:2]]  # Show next 2
            interview_context += f"""UPCOMING AREAS: {', '.join(remaining_areas)}

"""
        
        interview_context += """INTERVIEW GUIDANCE:
- Maintain a professional, conversational tone
- Ask one thoughtful question at a time
- Probe for depth and specific examples
- Challenge the candidate appropriately to assess their capabilities
- Transition naturally between topics when each area is thoroughly explored
- Keep the conversation flowing and engaging throughout
- Be mindful of time allocation and ensure all important areas are covered
"""
        
        # Combine original instructions with context
        enhanced_instructions = f"{base_instructions}\n\n{interview_context}"
        
        return enhanced_instructions
    
    def _should_refresh_prompt(self) -> bool:
        """
        Check if it's time to refresh the system prompt
        """
        if not self.last_prompt_refresh:
            logger.debug("No previous prompt refresh recorded")
            return False
            
        time_since_refresh = time.time() - self.last_prompt_refresh
        should_refresh = time_since_refresh >= self.prompt_refresh_interval
        
        if should_refresh:
            logger.info(f"⏰ Time for prompt refresh: {time_since_refresh:.1f}s since last refresh (interval: {self.prompt_refresh_interval}s)")
        
        return should_refresh
    
    async def force_refresh_system_prompt(self):
        """
        Force refresh the system prompt immediately (for testing/debugging)
        """
        logger.info("🔧 Manual system prompt refresh triggered")
        await self._refresh_system_prompt()
    
    def get_prompt_reinforcement_status(self) -> dict:
        """
        Get current status of prompt reinforcement system
        """
        if not self.last_prompt_refresh:
            return {
                "status": "not_initialized",
                "original_instructions_stored": bool(self.original_instructions),
                "time_since_last_refresh": None,
                "next_refresh_in": None,
                "response_count": self.response_count,
                "next_response_refresh_at": self.reinforce_every_n_responses - (self.response_count % self.reinforce_every_n_responses)
            }
        
        time_since_refresh = time.time() - self.last_prompt_refresh
        next_refresh_in = max(0, self.prompt_refresh_interval - time_since_refresh)
        
        return {
            "status": "active",
            "original_instructions_stored": bool(self.original_instructions),
            "time_since_last_refresh": time_since_refresh,
            "next_refresh_in": next_refresh_in,
            "refresh_interval": self.prompt_refresh_interval,
            "response_count": self.response_count,
            "next_response_refresh_at": self.reinforce_every_n_responses - (self.response_count % self.reinforce_every_n_responses),
            "response_refresh_interval": self.reinforce_every_n_responses
        }
    
    def _create_context_aware_instructions(self) -> str:
        """Create subtle context guidance that doesn't expose internal mechanics"""
        if not self.meeting_agenda:
            return "Continue conducting a thorough and engaging interview. Ask probing questions."
        
        modules = self.meeting_agenda.get("modules", [])
        current_index = self.current_topic_index
        
        if current_index >= len(modules):
            return "You've covered the key areas. Start wrapping up professionally."
        
        current_module = modules[current_index]
        guidance = "Continue the interview naturally. "
        
        # Add subtle focus guidance based on current module
        title = current_module['title'].lower()
        if 'introduction' in title:
            guidance += "Focus on building rapport and getting comfortable."
        elif 'technical' in title:
            guidance += "Deep dive into technical abilities. Challenge them with scenarios."
        elif 'experience' in title:
            guidance += "Explore work history in detail. Ask about specific projects."
        elif 'behavioral' in title:
            guidance += "Ask situational questions about teamwork and problem-solving."
        elif 'closing' in title:
            guidance += "Give them a chance to ask questions and wrap up."
        
        guidance += " Ask one thoughtful question at a time and probe deeper."
        return guidance
        """
        Create dynamic instructions that include current agenda context for response generation
        """
        base_instruction = "Stay focused on your role as an AI Interviewer. Follow the structured meeting agenda and maintain interview flow."
        
        if not self.meeting_agenda:
            return base_instruction
        
        modules = self.meeting_agenda.get("modules", [])
        current_index = self.current_topic_index
        completed_topics = self.completed_topics
        
        if current_index >= len(modules):
            return f"{base_instruction}\n\n✅ All agenda modules completed. Wrap up the interview professionally."
        
        current_module = modules[current_index]
        
        # Quick context for response generation
        context_summary = f"""

� INTERVIEW STATUS:
- Module {current_index + 1}/{len(modules)}: {current_module['title']} ({current_module['duration_minutes']} min)
- Completed: {len(completed_topics)} | Remaining: {len(modules) - current_index}

🎯 CURRENT FOCUS:
- Objectives: {', '.join(current_module['objectives'])}
- Key Questions: {', '.join(current_module['key_questions'])}
- Evaluation: {', '.join(current_module['evaluation_criteria'])}

⚡ ACTIONS:
- Use mark_topic_complete() when this module is thoroughly covered
- Use get_current_agenda() to check progress if needed
- Transition to next module when appropriate"""
        
        # Add next topic preview if available
        if current_index + 1 < len(modules):
            next_module = modules[current_index + 1]
            context_summary += f"\n- Next: {next_module['title']} ({next_module['duration_minutes']} min)"
        
        return base_instruction + context_summary
    
    async def send_audio_chunk(self, audio_data: bytes):
        """
        Send audio chunk to Azure OpenAI with detailed logging
        """
        if not self.is_connected or not self.websocket:
            logger.error("❌ Cannot send audio chunk: Not connected to Azure Realtime API")
            raise Exception("Not connected to Azure Realtime API")
            
        try:
            # Log audio chunk details
            chunk_size = len(audio_data)
            timestamp = datetime.now().isoformat()
            
            logger.info(f"📤 Sending audio chunk: {chunk_size} bytes at {timestamp}")
            logger.debug(f"🔊 Audio chunk details: size={chunk_size}, connection_stable={self.is_connected and self.websocket is not None}")
            
            # Convert audio data to base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            event = {
                "type": "input_audio_buffer.append",
                "audio": audio_base64
            }
            
            # Log the send operation
            await self.websocket.send(json.dumps(event))
            logger.debug(f"✅ Audio chunk sent successfully: {chunk_size} bytes")
            
        except Exception as e:
            logger.error(f"❌ Failed to send audio chunk: {e}")
            logger.error(f"Connection state: {self.is_connected and self.websocket is not None}")
            raise
    
    async def commit_audio_and_respond(self):
        """
        Commit the audio buffer and request AI response with context reinforcement
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
        
        # Check if we need to refresh the system prompt
        if self._should_refresh_prompt():
            await self._refresh_system_prompt()
        
        # Increment response count for periodic reinforcement
        self.response_count += 1
        logger.debug(f"🔢 Response count: {self.response_count} (reinforce every {self.reinforce_every_n_responses})")
            
        # Commit audio buffer
        commit_event = {
            "type": "input_audio_buffer.commit"
        }
        await self.websocket.send(json.dumps(commit_event))
        
        # Request response with context-aware instructions
        context_instructions = self._create_context_aware_instructions()
        logger.debug(f"📋 Using context-aware instructions (length: {len(context_instructions)} chars)")
        
        response_event = {
            "type": "response.create",
            "response": {
                "modalities": ["text", "audio"],
                "instructions": context_instructions
            }
        }
        
        # Periodically reinforce the full system prompt
        if self.response_count % self.reinforce_every_n_responses == 0:
            logger.info(f"🔄 Response-count based prompt reinforcement triggered (response #{self.response_count})")
            await self._refresh_system_prompt()
        
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
    
    async def send_system_message(self, text: str):
        """
        Send a system message for prompts and reminders
        """
        if not self.is_connected or not self.websocket:
            logger.warning("Cannot send system message - not connected")
            return
            
        try:
            event = {
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text", 
                            "text": text
                        }
                    ]
                }
            }
            
            await self.websocket.send(json.dumps(event))
            logger.debug(f"📨 Sent system message: {text[:100]}...")
            
        except Exception as e:
            logger.error(f"❌ Error sending system message: {e}")
    
    async def request_response(self, instructions: Optional[str] = None):
        """
        Request a response from the AI with context reinforcement
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
        
        # Check if we need to refresh the system prompt
        if self._should_refresh_prompt():
            await self._refresh_system_prompt()
        
        # Increment response count
        self.response_count += 1
        
        # Use provided instructions or create context-aware ones
        if instructions:
            final_instructions = instructions
        else:
            final_instructions = self._create_context_aware_instructions()
            
        response_event = {
            "type": "response.create",
            "response": {
                "modalities": ["text", "audio"],
                "instructions": final_instructions
            }
        }
        
        # Periodically reinforce the full system prompt
        if self.response_count % self.reinforce_every_n_responses == 0:
            logger.info(f"🔄 Reinforcing system prompt (response #{self.response_count})")
            await self._refresh_system_prompt()
            
        await self.websocket.send(json.dumps(response_event))
    
    async def _handle_function_call(self, data: dict):
        """
        Handle function calls from the AI (like end_interview, mark_topic_complete, get_current_agenda)
        """
        try:
            # Try different ways to extract function name and arguments
            function_name = None
            arguments = {}
            call_id = ""
            
            # Method 1: Direct function_name field
            if data.get("function_name"):
                function_name = data.get("function_name")
                arguments = data.get("arguments", {})
                call_id = data.get("call_id", "")
            
            # Method 2: In item structure
            elif data.get("item"):
                item = data.get("item")
                if item.get("type") == "function_call":
                    function_name = item.get("name") or item.get("function_name")
                    arguments = item.get("arguments", {})
                    call_id = item.get("call_id", "")
            
            # Method 3: In output_item structure  
            elif data.get("output_item"):
                output_item = data.get("output_item")
                if output_item.get("type") == "function_call":
                    function_name = output_item.get("name") or output_item.get("function_name")
                    arguments = output_item.get("arguments", {})
                    call_id = output_item.get("call_id", "")
            
            # Method 4: Direct name field
            elif data.get("name"):
                function_name = data.get("name")
                arguments = data.get("arguments", {})
                call_id = data.get("call_id", "")
            
            logger.info(f"🔍 Function extraction result: name='{function_name}', args={arguments}")
            
            # Parse arguments if they're a string
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except json.JSONDecodeError:
                    logger.warning(f"Could not parse function arguments: {arguments}")
                    arguments = {}
            
            # Handle different function calls
            function_output = ""
            
            if function_name == "end_interview":
                logger.info("🎯 AI requested to end interview")
                
                reason = arguments.get("reason", "Interview completed")
                summary = arguments.get("summary", "")
                
                logger.info(f"End reason: {reason}")
                if summary:
                    logger.info(f"Summary: {summary}")
                
                # Store the end request for the interview manager to handle
                self.interview_end_requested = True
                self.interview_end_reason = reason
                self.interview_end_summary = summary
                
                function_output = "Interview end request received and processed successfully."
                
            elif function_name == "mark_topic_complete":
                logger.info("📋 AI marking topic as complete")
                
                topic_summary = arguments.get("topic_summary", "Topic completed")
                candidate_performance = arguments.get("candidate_performance", "Average")
                
                if self.meeting_agenda and self.current_topic_index < len(self.meeting_agenda.get("modules", [])):
                    current_module = self.meeting_agenda["modules"][self.current_topic_index]
                    
                    # Mark current topic as completed
                    completion_info = {
                        "module_id": current_module["id"],
                        "title": current_module["title"],
                        "summary": topic_summary,
                        "performance": candidate_performance,
                        "completed_at": datetime.now().isoformat()
                    }
                    self.completed_topics.append(completion_info)
                    
                    # Move to next topic
                    self.current_topic_index += 1
                    
                    # Enhanced logging for module transition
                    logger.info(f"🔄 MODULE TRANSITION: Completed '{current_module['title']}'")
                    logger.info(f"📊 Module Progress: {len(self.completed_topics)}/{len(self.meeting_agenda['modules'])} completed")
                    
                    # Update topic transition timing in interview manager
                    if hasattr(self, 'interview_manager_ref') and self.interview_manager_ref:
                        self.interview_manager_ref.last_topic_transition_time = time.time()
                        logger.info(f"📋 Topic transition timing updated for module: {current_module['title']}")
                    
                    # Log current module status after transition
                    self.log_module_status()
                    
                    if self.current_topic_index < len(self.meeting_agenda["modules"]):
                        next_module = self.meeting_agenda["modules"][self.current_topic_index]
                        logger.info(f"▶️  NEXT MODULE: {next_module['title']} ({next_module['duration_minutes']} min)")
                        function_output = f"""✅ Topic '{current_module['title']}' marked as complete.

📋 NEXT TOPIC: {next_module['title']} ({next_module['duration_minutes']} min)
🎯 OBJECTIVES: {', '.join(next_module['objectives'])}
❓ KEY QUESTIONS: {', '.join(next_module['key_questions'])}
📊 EVALUATE: {', '.join(next_module['evaluation_criteria'])}

💬 TRANSITION: {next_module.get('transition_note', 'Moving to next topic...')}

Progress: {len(self.completed_topics)}/{len(self.meeting_agenda['modules'])} modules completed.

🔄 REMINDER: You are an AI Interviewer following a structured agenda. Stay focused on the current module objectives and use the suggested questions."""
                        
                        # Force a prompt refresh when moving to next topic
                        asyncio.create_task(self._refresh_system_prompt())
                        
                    else:
                        function_output = f"""✅ Topic '{current_module['title']}' marked as complete.

🎉 ALL TOPICS COMPLETED! 
📊 Interview Progress: {len(self.completed_topics)}/{len(self.meeting_agenda['modules'])} modules done.

All planned interview topics have been successfully covered. Please now transition to the closing phase by thanking the candidate and asking for their questions before ending the interview.

🔄 REMINDER: Follow the proper closing protocol - thank them, ask for their questions, provide next steps, then end warmly."""
                        
                        # Trigger proper interview closing sequence
                        if hasattr(self, 'interview_manager_ref'):
                            asyncio.create_task(self.interview_manager_ref.initiate_interview_closing())
                else:
                    function_output = "❌ No active meeting agenda found or all topics already completed."
                
            elif function_name == "get_current_agenda":
                logger.info("📋 AI requesting current agenda status")
                
                if not self.meeting_agenda:
                    function_output = "❌ No meeting agenda has been created yet."
                else:
                    modules = self.meeting_agenda.get("modules", [])
                    total_modules = len(modules)
                    completed_count = len(self.completed_topics)
                    
                    if self.current_topic_index < total_modules:
                        current_module = modules[self.current_topic_index]
                        remaining_modules = modules[self.current_topic_index + 1:]
                        
                        function_output = f"""📋 MEETING AGENDA STATUS

🕐 Total Duration: {self.meeting_agenda.get('total_duration_minutes', 'N/A')} minutes
📊 Progress: {completed_count}/{total_modules} modules completed

🔄 CURRENT MODULE: {current_module['title']} ({current_module['duration_minutes']} min)
🎯 Objectives: {', '.join(current_module['objectives'])}
❓ Key Questions: {', '.join(current_module['key_questions'])}
📊 Evaluate: {', '.join(current_module['evaluation_criteria'])}

✅ COMPLETED TOPICS: {[topic['title'] for topic in self.completed_topics]}

📝 REMAINING TOPICS: {[module['title'] for module in remaining_modules]}

💡 TIP: Focus on current module objectives and use mark_topic_complete when done."""
                    else:
                        function_output = f"""📋 MEETING AGENDA STATUS

✅ ALL MODULES COMPLETED! ({completed_count}/{total_modules})

Completed Topics:
""" + "\n".join([f"• {topic['title']} - {topic['performance']} ({topic['summary']})" for topic in self.completed_topics]) + "\n\n🎯 Ready to end interview!"
            
            elif function_name == "get_time_status":
                logger.info("⏰ AI requesting time status information")
                
                if hasattr(self, 'interview_manager_ref') and self.interview_manager_ref and self.interview_manager_ref.interview_start_time:
                    mgr = self.interview_manager_ref
                    elapsed = mgr.get_elapsed_interview_time()
                    remaining = mgr.get_remaining_interview_time()
                    percentage = (elapsed / mgr.interview_duration) * 100
                    
                    function_output = f"""⏰ INTERVIEW TIME STATUS

📅 Total Interview Duration: {mgr.interview_duration} minutes
⏱️ Elapsed Time: {elapsed:.1f} minutes ({percentage:.0f}% complete)
⏳ Remaining Time: {remaining:.1f} minutes

📊 Time Progress: {"You're ahead of schedule" if percentage < 70 else "You're on track" if percentage < 85 else "Time is running short"}

💡 GUIDANCE: {"Feel free to explore topics in depth" if percentage < 70 else "Maintain good pacing" if percentage < 85 else "Focus on key points and prepare to wrap up"}"""
                else:
                    function_output = "⏰ Interview timer not yet started or unavailable."
            
            else:
                function_output = f"❌ Unknown function: {function_name}"
                logger.warning(f"Unknown function called: {function_name}")
            
            # Send function response back to AI
            function_response = {
                "type": "conversation.item.create",
                "item": {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": function_output
                }
            }
            
            if self.websocket and self.is_connected:
                await self.websocket.send(json.dumps(function_response))
                logger.info(f"✅ Sent function response for '{function_name}' back to AI")
                
                # CRITICAL: Request immediate response to continue conversation after function call
                await asyncio.sleep(0.1)  # Brief delay to ensure function response is processed
                await self.request_response()
                logger.info("🔄 Requested AI response continuation after function call")
                
        except Exception as e:
            logger.error(f"Error handling function call: {e}")
            logger.error(f"Function call data was: {data}")
            
            # Send error response back to AI
            error_response = {
                "type": "conversation.item.create",
                "item": {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": f"❌ Error processing function call: {str(e)}"
                }
            }
            
            if self.websocket and self.is_connected:
                try:
                    await self.websocket.send(json.dumps(error_response))
                    
                    # Request response continuation even after error
                    await asyncio.sleep(0.1)
                    await self.request_response()
                    logger.info("🔄 Requested AI response continuation after function error")
                    
                except Exception as send_error:
                    logger.error(f"Failed to send error response: {send_error}")

    async def listen_for_responses(self, message_handler: Callable):
        """
        Listen for responses from Azure OpenAI and handle them
        """
        if not self.is_connected or not self.websocket:
            raise Exception("Not connected to Azure Realtime API")
            
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    
                    # Debug: Log all message types to see what we're getting
                    message_type = data.get("type", "unknown")
                    if "function" in message_type.lower() or "tool" in message_type.lower():
                        logger.info(f"🔧 Function-related event received: {message_type}")
                        logger.debug(f"Function event data: {data}")
                    
                    # Handle function calls - only process once on completion
                    if message_type == "response.output_item.done":
                        # Check if this is actually a function call
                        if data.get("item", {}).get("type") == "function_call":
                            logger.info(f"🎯 Function call completed in {message_type}: {data}")
                            await self._handle_function_call(data)
                    elif message_type in ["response.function_call_delta", "response.function_call_arguments.delta"]:
                        logger.info(f"🔧 Function-related event received: {message_type}")
                        logger.debug(f"Function event data: {data}")
                    elif message_type in ["response.function_call_done", "response.function_call_arguments.done"]:
                        logger.info(f"🔧 Function-related event received: {message_type}")
                        logger.debug(f"Function event data: {data}")
                    
                    await message_handler(data)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse WebSocket message: {e}")
                    continue
                except websockets.ConnectionClosed:
                    logger.info("Azure WebSocket connection closed")
                    break
                    
        except websockets.ConnectionClosed:
            logger.info("Azure WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"Error in listen_for_responses: {e}")
            self.is_connected = False
            self.is_connected = False
            raise
    
    def is_connection_expired(self) -> bool:
        """
        Check if connection has exceeded maximum allowed time (billing protection)
        """
        if not self.start_time:
            return False
        return (time.time() - self.start_time) > self.connection_timeout
    
    def track_ai_message(self, message_content: str):
        """
        Track AI messages to understand what questions were asked for fair assessment
        """
        if not self.meeting_agenda or not message_content:
            return
        
        modules = self.meeting_agenda.get("modules", [])
        if self.current_topic_index >= len(modules):
            return
        
        current_module = modules[self.current_topic_index]
        module_id = current_module.get("id", self.current_topic_index)
        module_title = current_module.get("title", f"Module {module_id}")
        
        # Initialize tracking for this module if not exists
        if module_id not in self.questions_asked_per_module:
            self.questions_asked_per_module[module_id] = {
                "module_title": module_title,
                "planned_questions": current_module.get("key_questions", []),
                "actual_questions_asked": [],
                "question_coverage_score": 0.0,
                "objectives_addressed": []
            }
        
        # Check if this message contains question patterns
        message_lower = message_content.lower()
        question_indicators = ["?", "tell me", "describe", "explain", "how", "what", "why", "when", "where", "can you", "would you", "could you"]
        
        if any(indicator in message_lower for indicator in question_indicators):
            # This appears to be a question
            self.questions_asked_per_module[module_id]["actual_questions_asked"].append({
                "question": message_content,
                "timestamp": datetime.now().isoformat(),
                "module_context": module_title
            })
            
            # Check if this question addresses module objectives
            objectives = current_module.get("objectives", [])
            for objective in objectives:
                obj_keywords = objective.lower().split()
                if any(keyword in message_lower for keyword in obj_keywords):
                    if objective not in self.questions_asked_per_module[module_id]["objectives_addressed"]:
                        self.questions_asked_per_module[module_id]["objectives_addressed"].append(objective)
            
            # Update coverage score
            planned_count = len(current_module.get("key_questions", []))
            asked_count = len(self.questions_asked_per_module[module_id]["actual_questions_asked"])
            
            # Log the question being tracked
            logger.info(f"📋 Question tracked in {module_title}: {message_content[:100]}...")
            logger.info(f"📊 Module progress: {asked_count} questions asked")
            
            # Update module status logging
            self.log_module_status()
            objectives_count = len(self.questions_asked_per_module[module_id]["objectives_addressed"])
            total_objectives = len(current_module.get("objectives", []))
            
            # Calculate coverage score (combination of questions asked and objectives addressed)
            question_score = min(1.0, asked_count / max(1, planned_count)) if planned_count > 0 else 1.0
            objective_score = objectives_count / max(1, total_objectives) if total_objectives > 0 else 1.0
            
            self.questions_asked_per_module[module_id]["question_coverage_score"] = (question_score * 0.6) + (objective_score * 0.4)
            
            logger.debug(f"📝 Question tracking - Module: {module_title}, Questions: {asked_count}/{planned_count}, Objectives: {objectives_count}/{total_objectives}, Coverage: {self.questions_asked_per_module[module_id]['question_coverage_score']:.2f}")
    
    def get_assessment_fairness_data(self) -> dict:
        """
        Get data about question coverage for fair assessment
        """
        if not self.meeting_agenda:
            return {"status": "no_agenda", "fairness_data": {}}
        
        modules = self.meeting_agenda.get("modules", [])
        fairness_summary = {
            "total_modules": len(modules),
            "modules_with_questions": 0,
            "average_coverage_score": 0.0,
            "module_coverage": {},
            "assessment_adjustments": []
        }
        
        total_coverage = 0.0
        
        for module in modules:
            module_id = module.get("id", modules.index(module))
            module_title = module.get("title", f"Module {module_id}")
            
            if module_id in self.questions_asked_per_module:
                fairness_summary["modules_with_questions"] += 1
                coverage_data = self.questions_asked_per_module[module_id]
                coverage_score = coverage_data.get("question_coverage_score", 0.0)
                total_coverage += coverage_score
                
                fairness_summary["module_coverage"][module_title] = {
                    "coverage_score": coverage_score,
                    "questions_planned": len(module.get("key_questions", [])),
                    "questions_asked": len(coverage_data.get("actual_questions_asked", [])),
                    "objectives_total": len(module.get("objectives", [])),
                    "objectives_addressed": len(coverage_data.get("objectives_addressed", [])),
                    "assessment_weight": self._calculate_assessment_weight(coverage_score)
                }
                
                # Add assessment adjustments for low coverage
                if coverage_score < 0.5:
                    fairness_summary["assessment_adjustments"].append({
                        "module": module_title,
                        "issue": "insufficient_questions",
                        "coverage_score": coverage_score,
                        "recommendation": "Reduce penalty for this module due to limited questioning"
                    })
            else:
                # Module was never properly addressed
                fairness_summary["module_coverage"][module_title] = {
                    "coverage_score": 0.0,
                    "questions_planned": len(module.get("key_questions", [])),
                    "questions_asked": 0,
                    "objectives_total": len(module.get("objectives", [])),
                    "objectives_addressed": 0,
                    "assessment_weight": 0.0
                }
                
                fairness_summary["assessment_adjustments"].append({
                    "module": module_title,
                    "issue": "no_questions_asked",
                    "coverage_score": 0.0,
                    "recommendation": "Do not penalize candidate - module was not properly evaluated"
                })
        
        if fairness_summary["modules_with_questions"] > 0:
            fairness_summary["average_coverage_score"] = total_coverage / fairness_summary["modules_with_questions"]
        
        return fairness_summary
    
    def _calculate_assessment_weight(self, coverage_score: float) -> float:
        """
        Calculate how much weight this module should have in final assessment
        """
        if coverage_score >= 0.8:
            return 1.0  # Full weight
        elif coverage_score >= 0.5:
            return 0.7  # Reduced weight
        elif coverage_score >= 0.3:
            return 0.4  # Minimal weight
        else:
            return 0.0  # No weight - unfair to assess
    
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
    
    def __init__(self, session_id: str, job_description: str, resume_text: str, candidate_name: str, interview_id: str = None, interview_duration: int = 30):
        self.session_id = session_id
        self.interview_id = interview_id  # Database interview schedule ID
        self.interview_duration = interview_duration  # Interview duration in minutes from database
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
        # Note: transcript is provided via @property, not stored as attribute
        self.current_user_speech = ""
        self.current_ai_response = ""
        
        # Connection monitoring for billing protection
        self.connection_monitor_task = None
        self.prompt_reinforcement_task = None
        
        # Greeting phase tracking
        self.greeting_phase_active = True  # Start in greeting phase
        self.functions_enabled = False  # Functions disabled initially
        
        # Interview time tracking for smart prompts
        self.interview_start_time = None
        self.last_time_reminder = None
        self.last_topic_transition_time = None
    
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
        
        # Note: transcript property will return live_transcript data
        
        logger.info(f"Added to transcript - {speaker}: {content[:100]}...")
    
    def start_interview_timer(self):
        """Start the interview timer"""
        self.interview_start_time = time.time()
        logger.info(f"🕐 Interview timer started for {self.interview_duration} minute interview")
    
    def get_elapsed_interview_time(self) -> float:
        """Get elapsed interview time in minutes"""
        if not self.interview_start_time:
            return 0.0
        return (time.time() - self.interview_start_time) / 60.0
    
    def get_remaining_interview_time(self) -> float:
        """Get remaining interview time in minutes"""
        elapsed = self.get_elapsed_interview_time()
        return max(0.0, self.interview_duration - elapsed)
    
    def should_send_time_reminder(self) -> bool:
        """Check if we should send a time reminder to the AI - less aggressive"""
        if not self.interview_start_time:
            return False
        
        elapsed = self.get_elapsed_interview_time()
        
        # Only send reminders at critical points: 50% and 85% of interview time
        reminder_points = [
            self.interview_duration * 0.50,  # 50% - midpoint
            self.interview_duration * 0.85   # 85% - near end
        ]
        
        for reminder_point in reminder_points:
            if elapsed >= reminder_point:
                # Check if we haven't already sent this reminder (at least 10 minutes apart)
                if not self.last_time_reminder or elapsed - self.last_time_reminder >= 10:
                    return True
        
        return False
    
    def should_prompt_topic_transition(self) -> bool:
        """Check if we should prompt the AI to move to the next topic - less aggressive"""
        if not self.audio_handler or not self.audio_handler.meeting_agenda:
            return False
        
        modules = self.audio_handler.meeting_agenda.get("modules", [])
        if not modules or self.audio_handler.current_topic_index >= len(modules):
            return False
        
        current_module = modules[self.audio_handler.current_topic_index]
        module_duration = current_module.get("duration_minutes", 5)
        
        # Check if we've been on current topic much too long (50% buffer instead of 20%)
        if self.last_topic_transition_time:
            time_on_topic = (time.time() - self.last_topic_transition_time) / 60.0
            return time_on_topic >= (module_duration * 1.5)  # 50% buffer - less aggressive
        
        return False
    
    async def handle_greeting_phase_transition(self):
        """Handle transition from greeting to structured interview phase"""
        if self.greeting_phase_active and not self.functions_enabled:
            logger.info("🎯 Transitioning from greeting phase to structured interview")
            
            # Re-enable functions
            if self.audio_handler:
                await self.audio_handler.enable_functions_after_greeting()
                self.functions_enabled = True
            
            # Send instruction to start using the agenda
            transition_instruction = """The greeting phase is complete. You can now access your interview functions.

Please use get_current_agenda() to check your interview structure and proceed with the structured interview based on the agenda.

Transition naturally from the greeting conversation into the first topic of your agenda."""
            
            if self.audio_handler:
                await self.audio_handler.request_response(transition_instruction)
            
            self.greeting_phase_active = False
            logger.info("✅ Greeting phase transition completed")
    
    async def initiate_interview_closing(self):
        """Initiate proper interview closing sequence when all modules are complete"""
        logger.info("🎯 Initiating proper interview closing sequence")
        
        closing_instruction = f"""INTERVIEW CLOSING PHASE:

All interview topics have been successfully completed. Now you must provide a proper, warm closing before ending the interview.

REQUIRED CLOSING SEQUENCE:
1. Thank {self.candidate_name} warmly for their time and thoughtful responses
2. Acknowledge the great conversation you've had together  
3. Ask: "Before we wrap up, do you have any questions about the role, our team, or the company?"
4. Allow them time to ask questions and provide helpful answers
5. Share next steps: "We'll be reviewing all interviews and will get back to you within [timeframe] with next steps"
6. Give them a warm farewell: "Thank you again, {self.candidate_name}. It was really great speaking with you today!"
7. ONLY after this complete closing sequence, call the end_interview function

Example closing:
"Thank you so much for taking the time to speak with me today, {self.candidate_name}. I really enjoyed our conversation and learning about your experience with [mention something specific]. Before we wrap up, do you have any questions about the role or our company that I can answer for you?"

Do NOT rush this closing. Make it warm, personal, and professional."""
        
        if self.audio_handler:
            await self.audio_handler.request_response(closing_instruction)
        
        logger.info("✅ Interview closing sequence initiated")
    
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
        """Push buffered transcription entries to database using Supabase REST"""
        if not self.transcription_buffer or not self.interview_id:
            return
        
        try:
            # Get existing transcript from Supabase
            supabase_url = os.getenv("SUPABASE_URL", "https://lmzzskcneufwglycfdov.supabase.co")
            service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
            
            headers = {
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                # Get existing transcript with proper URL encoding
                response = await client.get(
                    f"{supabase_url}/rest/v1/interview_sessions",
                    params={"id": f"eq.{self.interview_id}", "select": "transcript"},
                    headers=headers,
                    timeout=30.0
                )
                
                # Check if response is successful, if not, initialize with empty transcript
                existing_transcript = []
                if response.status_code == 200:
                    results = response.json()
                    if results and len(results) > 0 and isinstance(results[0], dict):
                        existing_transcript_data = results[0].get('transcript', {})
                        # Handle both old format (direct array) and new format (with live_transcript key)
                        if isinstance(existing_transcript_data, list):
                            existing_transcript = existing_transcript_data
                        elif isinstance(existing_transcript_data, dict):
                            existing_transcript = existing_transcript_data.get('live_transcript', [])
                        else:
                            existing_transcript = []
                    else:
                        existing_transcript = []
                else:
                    logger.warning(f"Could not fetch existing transcript: {response.status_code}, initializing empty")
                
                # Append new entries
                updated_transcript = existing_transcript + self.transcription_buffer
                
                # Update the database with correct column name
                update_data = {
                    "transcript": {
                        "live_transcript": updated_transcript,
                        "conversation": "",  # Will be populated during finalization
                        "timestamp": datetime.now().isoformat()
                    },
                    "updated_at": datetime.now().isoformat()
                }
                
                response = await client.patch(
                    f"{supabase_url}/rest/v1/interview_sessions",
                    params={"id": f"eq.{self.interview_id}"},
                    json=update_data,
                    headers=headers,
                    timeout=30.0
                )
                
                logger.info(f"📤 PATCH response: {response.status_code}")
                logger.info(f"📤 PATCH data sent: {json.dumps(update_data, indent=2)}")
                
                if response.status_code in [200, 204]:
                    logger.info(f"✅ Pushed {len(self.transcription_buffer)} transcript entries to Supabase")
                    self.transcription_buffer.clear()
                    
                    # Verify the data was saved by reading it back
                    verify_response = await client.get(
                        f"{supabase_url}/rest/v1/interview_sessions",
                        params={"id": f"eq.{self.interview_id}", "select": "transcript"},
                        headers=headers,
                        timeout=30.0
                    )
                    
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        if verify_data and len(verify_data) > 0:
                            saved_transcript = verify_data[0].get('transcript', {})
                            saved_entries = saved_transcript.get('live_transcript', []) if isinstance(saved_transcript, dict) else []
                            logger.info(f"✅ Verified: {len(saved_entries)} transcript entries saved in database")
                        else:
                            logger.warning("⚠️ No data returned in verification check")
                    else:
                        logger.warning(f"⚠️ Could not verify transcript save: {verify_response.status_code}")
                else:
                    logger.error(f"Failed to update transcript: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.error(f"❌ Failed to push transcription to Supabase: {e}")
            # Keep buffer for retry
            pass
    
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
        Create a professional, human-like interview prompt that focuses on deep questioning
        """
        return f"""You are a senior technical recruiter conducting a professional interview. Your goal is to thoroughly evaluate the candidate's technical abilities, problem-solving skills, and cultural fit through insightful questions and meaningful conversation.

INTERVIEW DURATION: {self.interview_duration} minutes
⏰ IMPORTANT: This interview is scheduled for exactly {self.interview_duration} minutes. Pace your questions accordingly and ensure you cover all important areas within this timeframe.

CANDIDATE: {self.candidate_name}

ROLE BEING INTERVIEWED FOR:
{self.job_description}

CANDIDATE'S BACKGROUND:
{self.resume_text[:1000]}{'...' if len(self.resume_text) > 1000 else ''}

YOUR INTERVIEW STYLE:
• Be conversational, professional, and naturally curious
• Ask one thoughtful question at a time
• Listen actively and ask intelligent follow-up questions
• Probe deeper when answers are surface-level or unclear
• Challenge the candidate appropriately to assess their depth
• Connect their answers back to the role requirements

QUESTIONING APPROACH:
• Start with open-ended questions to let them elaborate
• Ask "Why?" and "How?" to understand their thinking process
• Request specific examples: "Can you walk me through a time when..."
• Explore edge cases: "What would you do if..." or "How would you handle..."
• Dig into technical decisions: "What led you to choose that approach?"
• Assess problem-solving: "How did you debug that?" or "What was your thought process?"

AREAS TO EXPLORE (Cover these naturally through conversation):

1. BACKGROUND & MOTIVATION
   - What drives them in their career?
   - Why are they interested in this specific role?
   - What are they looking for in their next opportunity?

2. TECHNICAL DEPTH
   - Ask about specific projects from their resume
   - Challenge them on technical decisions they've made
   - Test their understanding of core concepts
   - Explore how they stay current with technology

3. PROBLEM-SOLVING ABILITIES
   - Present hypothetical scenarios relevant to the role
   - Ask them to walk through their problem-solving process
   - Understand how they approach debugging and troubleshooting
   - Assess their analytical thinking

4. EXPERIENCE & ACHIEVEMENTS
   - Deep dive into their most significant accomplishments
   - Understand the challenges they've overcome
   - Learn about their role in team projects
   - Explore lessons learned from failures or setbacks

5. COLLABORATION & COMMUNICATION
   - How do they work with different types of team members?
   - How do they handle disagreements or conflicts?
   - Can they explain complex technical concepts clearly?
   - How do they approach mentoring or being mentored?

6. ROLE-SPECIFIC ASSESSMENT
   - Test knowledge directly relevant to this position
   - Understand their experience with required technologies
   - Assess their ability to grow into this role
   - Explore their interest in the company and industry

CONVERSATION FLOW:
• Begin with a warm greeting and rapport building
• Transition naturally between topics based on their responses
• Ask follow-up questions that build on what they've shared
• Don't rush - let them think and provide thoughtful answers
• Maintain a professional but friendly tone throughout

TIME MANAGEMENT (Interview Duration: {self.interview_duration} minutes):
• Allocate your time wisely across all topic areas
• If this is a short interview ({self.interview_duration} ≤ 20 min), focus on the most critical 2-3 areas
• If this is a standard interview ({self.interview_duration} 25-45 min), cover all major areas with good depth
• If this is a long interview ({self.interview_duration} > 45 min), explore each area thoroughly with detailed follow-ups
• Keep track of time mentally and adjust your pacing accordingly
• Ensure you leave time for their questions and proper closing

DEEP QUESTIONING TECHNIQUES:
• "Tell me more about..." - to get elaboration
• "What was your thought process..." - to understand reasoning
• "Can you give me a specific example..." - for concrete evidence
• "How did you approach..." - to understand methodology
• "What would you do differently..." - for self-reflection
• "Walk me through..." - for detailed explanations

EVALUATION FOCUS:
• Technical competency relevant to the role
• Problem-solving and analytical abilities
• Communication and interpersonal skills
• Cultural fit and team collaboration
• Growth potential and learning agility
• Genuine interest in the role and company

INTERVIEW CLOSING PROTOCOL:
When all topics are completed, do NOT immediately end the interview. Follow this closing sequence:
1. Thank the candidate warmly for their time and thoughtful responses
2. Acknowledge the great conversation and their insights
3. Ask: "Do you have any questions about the role, team, or company?"
4. Allow time for their questions and provide thoughtful answers
5. Share information about next steps in the hiring process
6. Give them a warm, professional farewell
7. ONLY THEN call the end_interview function

Remember: Your goal is to have a meaningful professional conversation that thoroughly evaluates this candidate. Be genuinely curious about their experiences and capabilities. Ask the hard questions that will reveal their true depth and potential.

INTERVIEW START PROTOCOL:
1. ALWAYS begin with a warm, personal greeting using their name
2. Introduce yourself as their interviewer 
3. Set a comfortable, professional tone
4. Ask them to tell you about themselves and their interest in this role
5. Listen to their response before proceeding to structured topics

DO NOT start by calling functions or checking agendas. Start with natural human conversation.

Example opening: "Hi {self.candidate_name}! Great to meet you. I'm excited to learn more about your background today. To get us started, could you tell me a bit about yourself and what drew you to apply for this position?" """

    async def initialize_audio_handler(self, api_key: str = None) -> bool:
        """
        Initialize the Azure audio handler and create meeting agenda (api_key parameter ignored for Azure)
        """
        self.audio_handler = AzureRealtimeAudioHandler(
            azure_endpoint=self.azure_endpoint,
            api_key=self.azure_api_key,
            deployment_name=self.azure_deployment,
            api_version=self.azure_api_version
        )
        
        # Set reference to interview manager for proper closing
        self.audio_handler.interview_manager_ref = self
        
        # Create meeting agenda using ProxyLLM
        logger.info("🤖 Creating detailed meeting agenda using ProxyLLM...")
        self.audio_handler.meeting_agenda = await self.audio_handler.create_meeting_agenda(
            self.job_description, 
            self.resume_text, 
            self.candidate_name,
            self.interview_duration
        )
        self.audio_handler.current_topic_index = 0
        self.audio_handler.completed_topics = []
        self.audio_handler.agenda_created = True
        
        # Save agenda to database for scorer synchronization
        if self.interview_id and self.audio_handler.meeting_agenda:
            await self._save_agenda_to_database()
        
        logger.info(f"✅ Meeting agenda created with {len(self.audio_handler.meeting_agenda.get('modules', []))} modules")
        
        # Log module coverage and status
        self.audio_handler.ensure_all_modules_covered()
        self.audio_handler.log_module_status()
        
        instructions = self.create_interview_prompt()
        
        # Use the new Azure Realtime connection method
        logger.info("🔌 Connecting to Azure Realtime API...")
        try:
            connection_result = await self.audio_handler.connect_azure_realtime(instructions)
            
            if connection_result:
                logger.info("✅ Connected to Azure Realtime")
            else:
                logger.error("❌ Failed to connect to Azure Realtime")
                
            return connection_result
        except Exception as conn_error:
            logger.error(f"❌ Exception during Azure connection: {conn_error}")
            logger.error(f"Error type: {type(conn_error).__name__}")
            return False
    
    async def _save_agenda_to_database(self):
        """
        Save the generated meeting agenda to the database using Supabase REST
        """
        try:
            agenda_config = {
                "meeting_agenda": self.audio_handler.meeting_agenda,
                "agenda_generated_at": datetime.now().isoformat(),
                "agenda_version": "v2.0",
                "generator_model": "proxyllm/azure-gpt-4.1"
            }
            
            # Update interview session with agenda
            await update_supabase(
                "interview_sessions",
                {"ai_interviewer_config": agenda_config},
                "id",
                self.interview_id
            )
            
            logger.info(f"✅ Saved meeting agenda to Supabase for interview {self.interview_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save agenda to Supabase: {e}")
            # Continue without agenda save
    
    async def start_interview(self):
        """
        Start the interview conversation with meeting agenda, live transcription and connection monitoring
        """
        if not self.audio_handler or not self.audio_handler.is_connected:
            raise Exception("Audio handler not initialized or connected")
            
        # Start interview timer for time management
        self.start_interview_timer()
        self.last_topic_transition_time = time.time()  # Initialize topic timing
        
        # Start transcription sync
        self.is_active = True
        await self.start_transcription_sync()
        
        # Start connection monitoring to prevent excessive billing
        await self.start_connection_monitoring()
        
        # Start smart prompt reinforcement monitoring
        await self.start_smart_prompt_reinforcement()
        
        # Add interview start to transcript
        self.add_to_transcript("system", f"Interview started for {self.candidate_name}", "system")
        
        # Log meeting agenda information
        if self.audio_handler.meeting_agenda:
            agenda_summary = {
                "total_modules": len(self.audio_handler.meeting_agenda.get("modules", [])),
                "estimated_duration": self.audio_handler.meeting_agenda.get("total_duration_minutes", "N/A"),
                "modules": [m["title"] for m in self.audio_handler.meeting_agenda.get("modules", [])]
            }
            self.add_to_transcript("system", f"Meeting agenda created: {json.dumps(agenda_summary)}", "system")
            logger.info(f"📋 Interview agenda: {agenda_summary}")
        
        # Send initial greeting message - START WITH NATURAL GREETING, NO FUNCTIONS
        greeting = f"Hello {self.candidate_name}! I'm excited to speak with you today."
        await self.audio_handler.send_text_message(greeting, "user")
        
        # DISABLE functions for greeting phase to prevent function calls
        await self.audio_handler.disable_functions_for_greeting()
        
        # CRITICAL: Start with natural greeting, NO function calls allowed
        initial_instruction = f"""GREETING PHASE - NO FUNCTIONS AVAILABLE:

You are starting an interview with {self.candidate_name}. Functions are currently disabled.

You MUST respond with a natural, warm greeting:

1. Greet {self.candidate_name} warmly by name
2. Introduce yourself as their interviewer  
3. Thank them for their time
4. Ask them to tell you about themselves and their interest in this position

Example response:
"Hello {self.candidate_name}! It's wonderful to meet you today. Thank you so much for taking the time to speak with me. I'm looking forward to getting to know more about your background and experience. 

To get us started, could you please tell me a bit about yourself and what initially attracted you to this particular role?"

Respond naturally and conversationally. You cannot call any functions right now - just have a normal greeting conversation."""

        await self.audio_handler.request_response(initial_instruction)
        
        logger.info(f"Azure interview started for session: {self.session_id} with structured agenda")
    
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
    
    async def start_prompt_reinforcement(self):
        """Start background task to periodically reinforce system prompt"""
        async def monitor_prompt_reinforcement():
            logger.info("🔄 Starting prompt reinforcement monitoring...")
            while self.is_active:
                try:
                    await asyncio.sleep(30)  # Check every 30 seconds for more frequent monitoring
                    
                    if not self.audio_handler:
                        logger.debug("No audio handler available for prompt reinforcement")
                        continue
                        
                    if not self.audio_handler.is_connected:
                        logger.debug("Audio handler not connected, skipping prompt refresh")
                        continue
                        
                    if self.audio_handler._should_refresh_prompt():
                        logger.info("⏰ Time-based prompt refresh triggered by monitoring task")
                        await self.audio_handler._refresh_system_prompt()
                    else:
                        # Log time remaining until next refresh
                        if self.audio_handler.last_prompt_refresh:
                            time_since_refresh = time.time() - self.audio_handler.last_prompt_refresh
                            time_remaining = self.audio_handler.prompt_refresh_interval - time_since_refresh
                            logger.debug(f"🕐 Next prompt refresh in {time_remaining:.1f} seconds")
                        
                except Exception as e:
                    logger.error(f"❌ Error in prompt reinforcement monitoring: {e}")
                    # Continue monitoring even if there's an error
        
        self.prompt_reinforcement_task = asyncio.create_task(monitor_prompt_reinforcement())
        logger.info("✅ Started prompt reinforcement monitoring to prevent context drift")
        logger.info(f"🔄 Prompt will refresh every {self.audio_handler.prompt_refresh_interval if self.audio_handler else 180} seconds")
    
    async def start_smart_prompt_reinforcement(self):
        """Start smart background task that monitors time and topic transitions for dynamic prompts"""
        async def smart_prompt_monitor():
            logger.info("🧠 Starting smart prompt reinforcement with time and topic awareness...")
            while self.is_active:
                try:
                    await asyncio.sleep(60)  # Check every 60 seconds - less aggressive
                    
                    if not self.audio_handler or not self.audio_handler.is_connected:
                        continue
                    
                    # Check for time reminders (less frequent)
                    if self.should_send_time_reminder():
                        await self._send_time_awareness_prompt()
                        self.last_time_reminder = self.get_elapsed_interview_time()
                    
                    # Check for topic transition prompts (less frequent)
                    if self.should_prompt_topic_transition():
                        await self._send_topic_transition_prompt()
                        self.last_topic_transition_time = time.time()
                    
                    # Regular agenda-aware prompt refresh (every 3 minutes instead of 2)
                    if self.audio_handler._should_refresh_prompt():
                        await self.audio_handler._refresh_system_prompt()
                        
                except Exception as e:
                    logger.error(f"❌ Error in smart prompt monitoring: {e}")
        
        self.prompt_reinforcement_task = asyncio.create_task(smart_prompt_monitor())
        logger.info("✅ Started smart prompt reinforcement with time and topic awareness")
    
    async def _send_time_awareness_prompt(self):
        """Send a subtle time awareness reminder to the AI"""
        try:
            elapsed = self.get_elapsed_interview_time()
            remaining = self.get_remaining_interview_time()
            percentage = (elapsed / self.interview_duration) * 100
            
            # More subtle, less intrusive time message
            if percentage >= 85:
                time_message = f"""⏰ Interview approaching end - {remaining:.0f} minutes remaining. Consider wrapping up current discussion and moving toward conclusion."""
            elif percentage >= 50:
                time_message = f"""⏰ Interview midpoint reached - {remaining:.0f} minutes remaining. Ensure balanced coverage of remaining topics."""
            else:
                return  # Don't send early reminders
            
            await self.audio_handler.send_system_message(time_message)
            logger.info(f"⏰ Sent subtle time reminder: {percentage:.0f}% complete, {remaining:.1f}min remaining")
            
        except Exception as e:
            logger.error(f"❌ Error sending time awareness prompt: {e}")
    
    async def _send_topic_transition_prompt(self):
        """Send a topic transition suggestion to the AI"""
        try:
            if not self.audio_handler.meeting_agenda:
                return
                
            modules = self.audio_handler.meeting_agenda.get("modules", [])
            current_index = self.audio_handler.current_topic_index
            
            if current_index < len(modules):
                current_module = modules[current_index]
                
                transition_message = f"""📋 TOPIC TRANSITION REMINDER:
You've been exploring "{current_module['title']}" for a while. Consider whether you've gathered sufficient insights in this area.

NEXT STEPS: If you feel you've adequately assessed this area, smoothly transition to the next part of your interview. Ask any final clarifying questions and then naturally move forward.

TRANSITION EXAMPLE: "That gives me good insight into your experience with [current topic]. Now I'd like to explore..."
"""
                
                await self.audio_handler.send_system_message(transition_message)
                logger.info(f"📋 Sent topic transition prompt for module: {current_module['title']}")
                
        except Exception as e:
            logger.error(f"❌ Error sending topic transition prompt: {e}")
    
    async def handle_client_audio(self, audio_data: str):
        """
        Handle audio data from client with detailed logging and improved error handling
        """
        if not self.audio_handler or not self.audio_handler.is_connected:
            logger.error("❌ Cannot handle client audio: Audio handler not available or not connected")
            # Don't raise exception, just log error to keep connection alive
            return
            
        try:
            # Log incoming audio data details
            timestamp = datetime.now().isoformat()
            base64_size = len(audio_data)
            
            logger.info(f"📥 Received client audio: {base64_size} base64 chars at {timestamp}")
            
            # Decode base64 audio data
            audio_bytes = base64.b64decode(audio_data)
            decoded_size = len(audio_bytes)
            
            logger.debug(f"🔄 Decoded audio: {decoded_size} bytes (from {base64_size} base64 chars)")
            logger.debug(f"🔗 Connection stable: {self.audio_handler.is_connected}")
            
            # Send to Azure
            await self.audio_handler.send_audio_chunk(audio_bytes)
            logger.debug(f"✅ Audio forwarded to Azure successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to handle client audio: {e}")
            logger.error(f"Audio handler state: connected={self.audio_handler.is_connected if self.audio_handler else 'None'}")
            # Don't re-raise the exception to keep the WebSocket connection alive
            # The client can continue with the interview even if one audio chunk fails
    
    async def commit_audio_and_respond(self):
        """
        Commit audio buffer and request AI response
        """
        if not self.audio_handler or not self.audio_handler.is_connected:
            raise Exception("Audio handler not available")
            
        await self.audio_handler.commit_audio_and_respond()
    
    async def handle_openai_message(self, message_data: dict):
        """
        Handle messages from Azure OpenAI and forward to client with enhanced transcription capture and logging
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
                # Check if client WebSocket is still open before sending
                if hasattr(self.client_websocket, 'client_state') and self.client_websocket.client_state.name != 'CONNECTED':
                    logger.debug("Client WebSocket not connected, skipping message forward")
                    return
                    
                await self.client_websocket.send_text(json.dumps(message_data))
                
                # Capture transcriptions for live storage with enhanced logging
                message_type = message_data.get("type")
                
                # Capture user speech transcription
                if message_type == "conversation.item.input_audio_transcription.completed":
                    user_speech = message_data.get("transcript", "")
                    if user_speech.strip():
                        logger.info(f"🎤 Transcript received: {user_speech}")
                        self.add_to_transcript("user", user_speech, "audio")
                        self.current_user_speech = user_speech
                        
                        # CRITICAL: Transition from greeting phase when candidate first responds
                        if self.greeting_phase_active and len(user_speech.strip()) > 10:  # Meaningful response
                            logger.info("🎯 Candidate responded to greeting - triggering phase transition")
                            await self.handle_greeting_phase_transition()
                
                # Capture AI text responses
                elif message_type == "response.text.done":
                    ai_response = message_data.get("text", "")
                    if ai_response.strip():
                        logger.info(f"🤖 Model response: {ai_response}")
                        self.add_to_transcript("assistant", ai_response, "text")
                        self.current_ai_response = ai_response
                        
                        # Track AI questions for fair assessment and module coverage
                        if self.audio_handler:
                            self.audio_handler.track_ai_message(ai_response)
                            
                            # Log current module coverage
                            if hasattr(self.audio_handler, 'meeting_agenda') and self.audio_handler.meeting_agenda:
                                modules = self.audio_handler.meeting_agenda.get("modules", [])
                                if self.audio_handler.current_topic_index < len(modules):
                                    current_module = modules[self.audio_handler.current_topic_index]
                                    module_title = current_module.get("title", f"Module {self.audio_handler.current_topic_index}")
                                    logger.info(f"📊 Module covered: {module_title}")
                        
                        # Also log for conversation history
                        self.conversation_history.append({
                            "role": "assistant",
                            "content": ai_response,
                            "timestamp": asyncio.get_event_loop().time()
                        })
                
                # Capture when user starts/stops speaking
                elif message_type == "input_audio_buffer.speech_started":
                    logger.info("🎤 User started speaking")
                    self.add_to_transcript("system", "User started speaking", "system")
                elif message_type == "input_audio_buffer.speech_stopped":
                    logger.info("🎤 User stopped speaking")
                    self.add_to_transcript("system", "User stopped speaking", "system")
                
                # Capture when AI starts responding
                elif message_type == "response.created":
                    logger.info("🤖 AI started responding")
                    self.add_to_transcript("system", "AI started responding", "system")
                elif message_type == "response.done":
                    logger.info("🤖 AI finished responding")
                    self.add_to_transcript("system", "AI finished responding", "system")
                    
                    # Check if AI requested to end the interview
                    if self.audio_handler and hasattr(self.audio_handler, 'interview_end_requested'):
                        if self.audio_handler.interview_end_requested:
                            logger.info("🤖 AI has completed the interview and requested to end session")
                            self.add_to_transcript("system", f"AI ended interview: {self.audio_handler.interview_end_reason}", "system")
                            
                            # Send notification to client
                            if self.client_websocket:
                                try:
                                    # Check if client WebSocket is still open before sending
                                    if hasattr(self.client_websocket, 'client_state') and self.client_websocket.client_state.name != 'CONNECTED':
                                        logger.debug("Client WebSocket not connected, skipping interview end notification")
                                    else:
                                        await self.client_websocket.send_text(json.dumps({
                                            "type": "interview_ended_by_ai",
                                            "reason": self.audio_handler.interview_end_reason,
                                            "summary": self.audio_handler.interview_end_summary
                                        }))
                                except Exception as e:
                                    logger.error(f"Error sending interview end notification: {e}")
                            
                            # Schedule interview end (with a small delay to let final messages process)
                            asyncio.create_task(self._delayed_interview_end())
                    
            except Exception as e:
                logger.error(f"Error forwarding message to client: {e}")
    
    async def _delayed_interview_end(self):
        """
        End the interview with a small delay to allow final messages to process
        """
        await asyncio.sleep(2)  # 2 second delay
        await self.end_interview()
    
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
                
        # Stop prompt reinforcement monitoring
        if self.prompt_reinforcement_task:
            try:
                self.prompt_reinforcement_task.cancel()
                await self.prompt_reinforcement_task
            except asyncio.CancelledError:
                logger.info("Prompt reinforcement task cancelled successfully")
            except Exception as e:
                logger.error(f"Error cancelling prompt reinforcement: {e}")
            finally:
                self.prompt_reinforcement_task = None
        
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
    
    @property
    def transcript(self):
        """Get transcript in format expected by finalize endpoint"""
        return self.get_live_transcript()
    
    def get_meeting_agenda_status(self):
        """Get current meeting agenda status and progress"""
        if not self.audio_handler or not self.audio_handler.meeting_agenda:
            return {"status": "no_agenda", "message": "No meeting agenda available"}
        
        agenda = self.audio_handler.meeting_agenda
        modules = agenda.get("modules", [])
        
        return {
            "status": "active",
            "total_modules": len(modules),
            "current_module_index": self.audio_handler.current_topic_index,
            "completed_modules": len(self.audio_handler.completed_topics),
            "estimated_duration_minutes": agenda.get("total_duration_minutes", "N/A"),
            "current_module": modules[self.audio_handler.current_topic_index] if self.audio_handler.current_topic_index < len(modules) else None,
            "completed_topics": [{"title": t["title"], "performance": t["performance"]} for t in self.audio_handler.completed_topics],
            "remaining_modules": [m["title"] for m in modules[self.audio_handler.current_topic_index + 1:]] if self.audio_handler.current_topic_index < len(modules) else []
        }
    
    def get_prompt_reinforcement_status(self) -> dict:
        """
        Get current status of the prompt reinforcement system
        """
        if not self.audio_handler:
            return {
                "status": "no_audio_handler",
                "message": "Audio handler not initialized"
            }
        
        return self.audio_handler.get_prompt_reinforcement_status()
    
    async def force_prompt_refresh(self):
        """
        Force a manual prompt refresh (for testing/debugging)
        """
        if not self.audio_handler:
            raise Exception("Audio handler not initialized")
        
        await self.audio_handler.force_refresh_system_prompt()
