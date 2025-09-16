import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
import httpx
import os
from enum import Enum

logger = logging.getLogger(__name__)

class SupervisorAction(Enum):
    IGNORE = "ignore"
    GUIDE = "guide"
    CONCLUDE = "conclude"
    END = "end"

class InterviewSupervisor:
    """
    AI-powered interview supervisor that monitors conversation flow and takes autonomous actions
    """
    
    def __init__(self, interview_manager, job_description: str, candidate_name: str, interview_id: str = None):
        self.interview_manager = interview_manager
        self.job_description = job_description
        self.candidate_name = candidate_name
        self.interview_id = interview_id
        
        # Supervisor configuration
        self.analysis_interval = 30  # Analyze every 30 seconds
        self.max_interview_duration = 35 * 60  # 35 minutes max
        self.conclusion_duration = 25 * 60  # Start concluding at 25 minutes
        
        # State tracking
        self.is_active = False
        self.supervisor_task = None
        self.last_analysis_time = 0
        self.analysis_count = 0
        self.actions_taken = []
        self.interview_start_time = time.time()
        self.conclusion_initiated = False
        self.awaiting_conclusion = False
        self.conclusion_start_time = None
        
        # Interview phase tracking
        self.interview_phases = ["opening", "technical", "behavioral", "closing"]
        self.current_phase = "opening"
        self.phase_start_time = time.time()
        
        # AI configuration
        self.proxyllm_url = os.getenv("PROXYLLM_URL", "https://proxyllm.ximplify.id/v1/chat/completions")
        self.proxyllm_key = os.getenv("PROXYLLM_KEY", "sk-CxXh7gykTHvf9Vvi3x9Ehg")
        self.proxyllm_model = os.getenv("PROXYLLM_MODEL", "azure/gpt-4.1")
    
    async def start_supervision(self):
        """Start the AI supervisor monitoring"""
        if self.is_active:
            return
            
        self.is_active = True
        self.interview_start_time = time.time()
        
        async def supervision_loop():
            while self.is_active:
                try:
                    await asyncio.sleep(self.analysis_interval)
                    
                    if not self.is_active:
                        break
                        
                    # Analyze transcript and take action
                    await self.analyze_and_act()
                    
                except Exception as e:
                    logger.error(f"Error in supervision loop: {e}")
        
        self.supervisor_task = asyncio.create_task(supervision_loop())
        logger.info(f"Started AI interview supervisor for session: {self.interview_manager.session_id}")
        
        # Log supervisor start action
        await self.log_supervisor_action("start", "Supervisor monitoring initiated", None)
    
    async def stop_supervision(self):
        """Stop the AI supervisor"""
        if not self.is_active:
            return
            
        self.is_active = False
        
        if self.supervisor_task:
            try:
                self.supervisor_task.cancel()
                await self.supervisor_task
            except asyncio.CancelledError:
                logger.info("Supervisor task cancelled successfully")
            except Exception as e:
                logger.error(f"Error cancelling supervisor task: {e}")
            finally:
                self.supervisor_task = None
        
        # Log supervisor stop action
        await self.log_supervisor_action("stop", "Supervisor monitoring stopped", None)
        logger.info(f"Stopped AI interview supervisor for session: {self.interview_manager.session_id}")
    
    async def analyze_and_act(self):
        """Analyze recent transcript and take appropriate action"""
        try:
            # Get recent transcript (last 30-60 seconds of content)
            recent_transcript = self.get_recent_transcript()
            
            if not recent_transcript:
                logger.debug("No recent transcript to analyze")
                return
            
            # Get interview context
            context = self.get_interview_context()
            
            # Analyze with AI
            analysis_result = await self.analyze_transcript(recent_transcript, context)
            
            if not analysis_result:
                logger.warning("Failed to get analysis result")
                return
            
            # Decide and execute action
            await self.execute_supervisor_action(analysis_result)
            
            self.analysis_count += 1
            self.last_analysis_time = time.time()
            
        except Exception as e:
            logger.error(f"Error in analyze_and_act: {e}")
    
    def get_recent_transcript(self) -> List[Dict]:
        """Get recent transcript entries for analysis"""
        current_time = time.time()
        recent_entries = []
        
        # Get entries from last 30-60 seconds
        for entry in reversed(self.interview_manager.live_transcript):
            try:
                entry_time = datetime.fromisoformat(entry.get("timestamp", "")).timestamp()
                time_diff = current_time - entry_time
                
                # Include entries from last 60 seconds for context
                if time_diff <= 60:
                    recent_entries.insert(0, entry)
                else:
                    break
            except:
                continue
        
        return recent_entries
    
    def get_interview_context(self) -> Dict[str, Any]:
        """Get current interview context for analysis"""
        current_time = time.time()
        elapsed_time = current_time - self.interview_start_time
        
        return {
            "job_description": self.job_description,
            "candidate_name": self.candidate_name,
            "elapsed_minutes": elapsed_time / 60,
            "current_phase": self.current_phase,
            "total_transcript_entries": len(self.interview_manager.live_transcript),
            "analysis_count": self.analysis_count,
            "conclusion_initiated": self.conclusion_initiated,
            "awaiting_conclusion": self.awaiting_conclusion,
            "max_duration_minutes": self.max_interview_duration / 60,
            "conclusion_trigger_minutes": self.conclusion_duration / 60
        }
    
    async def analyze_transcript(self, recent_transcript: List[Dict], context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Use AI to analyze transcript and recommend action"""
        try:
            # Create transcript text
            transcript_text = self.format_transcript_for_analysis(recent_transcript)
            
            # Create analysis prompt
            prompt = self.create_analysis_prompt(transcript_text, context)
            
            # Call AI for analysis
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.proxyllm_url,
                    headers={"Authorization": f"Bearer {self.proxyllm_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.proxyllm_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3,
                        "max_tokens": 500
                    }
                )
                
                if response.status_code == 200:
                    analysis_json = response.json()["choices"][0]["message"]["content"]
                    return json.loads(analysis_json)
                else:
                    logger.error(f"AI analysis failed: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error in AI transcript analysis: {e}")
            return None
    
    def format_transcript_for_analysis(self, transcript_entries: List[Dict]) -> str:
        """Format transcript entries for AI analysis"""
        formatted_lines = []
        
        for entry in transcript_entries:
            speaker = entry.get("speaker", "unknown")
            content = entry.get("content", "")
            timestamp = entry.get("timestamp", "")
            
            # Skip system messages for analysis
            if speaker == "system" or not content.strip():
                continue
                
            # Format: [10:30] Interviewer: "Tell me about your experience..."
            try:
                time_obj = datetime.fromisoformat(timestamp)
                time_str = time_obj.strftime("%H:%M")
            except:
                time_str = "00:00"
            
            speaker_label = "Interviewer" if speaker == "assistant" else "Candidate"
            formatted_lines.append(f"[{time_str}] {speaker_label}: {content}")
        
        return "\n".join(formatted_lines)
    
    def create_analysis_prompt(self, transcript_text: str, context: Dict[str, Any]) -> str:
        """Create the AI analysis prompt"""
        return f"""You are an expert interview supervisor AI. Analyze this recent interview transcript and recommend an action.

JOB DESCRIPTION:
{context['job_description']}

CANDIDATE: {context['candidate_name']}

INTERVIEW CONTEXT:
- Elapsed time: {context['elapsed_minutes']:.1f} minutes
- Current phase: {context['current_phase']}
- Total entries: {context['total_transcript_entries']}
- Conclusion initiated: {context['conclusion_initiated']}
- Max duration: {context['max_duration_minutes']} minutes

RECENT TRANSCRIPT (last 30-60 seconds):
{transcript_text}

ANALYSIS CRITERIA:
1. Topic Relevance (0-100): Is conversation relevant to the job requirements?
2. Question Quality (0-100): Are interviewer questions effective and appropriate?
3. Answer Quality (0-100): Are candidate responses substantial and informative?
4. Interview Progress (0-100): How complete is the interview coverage?
5. Time Efficiency (0-100): Is time being used effectively?

ACTION OPTIONS:
- ignore: Continue normally, no intervention needed
- guide: Send guidance message to redirect conversation
- conclude: Signal interviewer to start wrapping up
- end: Automatically end the interview

DECISION RULES:
- ignore: All metrics > 70%, time < {context['conclusion_trigger_minutes']} min, good progress
- guide: Topic relevance < 70% OR question quality < 60% OR off-topic discussion
- conclude: Progress > 85% OR time > {context['conclusion_trigger_minutes']} min OR sufficient coverage
- end: Time > {context['max_duration_minutes']} min OR explicit completion OR technical issues

Respond with JSON only:
{{
  "action": "ignore|guide|conclude|end",
  "confidence": 0-100,
  "topic_relevance": 0-100,
  "question_quality": 0-100, 
  "answer_quality": 0-100,
  "interview_progress": 0-100,
  "time_efficiency": 0-100,
  "reasoning": "Brief explanation of decision",
  "guidance_message": "Message to send if action is 'guide' or 'conclude'"
}}"""
    
    async def execute_supervisor_action(self, analysis: Dict[str, Any]):
        """Execute the recommended supervisor action"""
        try:
            action = analysis.get("action", "ignore")
            reasoning = analysis.get("reasoning", "")
            guidance_message = analysis.get("guidance_message", "")
            confidence = analysis.get("confidence", 0)
            
            logger.info(f"Supervisor action: {action} (confidence: {confidence}%) - {reasoning}")
            
            if action == SupervisorAction.IGNORE.value:
                await self.action_ignore(analysis)
                
            elif action == SupervisorAction.GUIDE.value:
                await self.action_guide(guidance_message, analysis)
                
            elif action == SupervisorAction.CONCLUDE.value:
                await self.action_conclude(guidance_message, analysis)
                
            elif action == SupervisorAction.END.value:
                await self.action_end(analysis)
            
            # Log the action taken
            await self.log_supervisor_action(action, reasoning, analysis)
            
        except Exception as e:
            logger.error(f"Error executing supervisor action: {e}")
    
    async def action_ignore(self, analysis: Dict[str, Any]):
        """Action: Continue monitoring, no intervention"""
        logger.debug("Supervisor: Continuing normal monitoring")
        # No action needed, just log
    
    async def action_guide(self, guidance_message: str, analysis: Dict[str, Any]):
        """Action: Send guidance to redirect conversation"""
        if not guidance_message:
            guidance_message = self.generate_default_guidance(analysis)
        
        try:
            # Send guidance message to the AI interviewer
            await self.interview_manager.audio_handler.send_text_message(
                f"[SUPERVISOR GUIDANCE] {guidance_message}", 
                "user"
            )
            
            # Request AI response with the guidance
            await self.interview_manager.audio_handler.request_response(
                f"Please incorporate this guidance into your next question or comment: {guidance_message}"
            )
            
            # Add to transcript for visibility
            self.interview_manager.add_to_transcript(
                "system", 
                f"Supervisor guidance: {guidance_message}", 
                "system"
            )
            
            logger.info(f"Supervisor guidance sent: {guidance_message}")
            
        except Exception as e:
            logger.error(f"Error sending supervisor guidance: {e}")
    
    async def action_conclude(self, guidance_message: str, analysis: Dict[str, Any]):
        """Action: Signal to start concluding the interview"""
        if self.conclusion_initiated:
            # Already concluding, check if we should end
            if self.conclusion_start_time and (time.time() - self.conclusion_start_time) > 120:  # 2 minutes
                await self.action_end(analysis)
            return
        
        self.conclusion_initiated = True
        self.awaiting_conclusion = True
        self.conclusion_start_time = time.time()
        
        if not guidance_message:
            guidance_message = "I think we've covered the key areas well. Let's start wrapping up the interview with any final questions or topics."
        
        try:
            # Send conclusion message
            await self.interview_manager.audio_handler.send_text_message(
                f"[SUPERVISOR] {guidance_message}", 
                "user"
            )
            
            await self.interview_manager.audio_handler.request_response(
                f"Please start concluding the interview: {guidance_message}"
            )
            
            # Add to transcript
            self.interview_manager.add_to_transcript(
                "system", 
                f"Supervisor initiated conclusion: {guidance_message}", 
                "system"
            )
            
            logger.info(f"Supervisor initiated conclusion: {guidance_message}")
            
        except Exception as e:
            logger.error(f"Error initiating conclusion: {e}")
    
    async def action_end(self, analysis: Dict[str, Any]):
        """Action: Automatically end the interview"""
        try:
            reasoning = analysis.get("reasoning", "Interview completion detected by supervisor")
            
            # Send final message to AI
            final_message = "Thank you for your time. This concludes our interview. We'll be in touch regarding next steps."
            
            await self.interview_manager.audio_handler.send_text_message(
                f"[SUPERVISOR] {final_message}", 
                "user"
            )
            
            await self.interview_manager.audio_handler.request_response(
                "Please provide a brief closing statement and thank the candidate for their time."
            )
            
            # Add to transcript
            self.interview_manager.add_to_transcript(
                "system", 
                f"Supervisor ended interview: {reasoning}", 
                "system"
            )
            
            logger.info(f"Supervisor ending interview: {reasoning}")
            
            # Wait a moment for final AI response, then end
            await asyncio.sleep(5)
            await self.interview_manager.end_interview()
            
        except Exception as e:
            logger.error(f"Error ending interview: {e}")
    
    def generate_default_guidance(self, analysis: Dict[str, Any]) -> str:
        """Generate default guidance message based on analysis"""
        topic_relevance = analysis.get("topic_relevance", 50)
        question_quality = analysis.get("question_quality", 50)
        
        if topic_relevance < 60:
            return "Let's refocus on the candidate's relevant experience for this role."
        elif question_quality < 60:
            return "Try asking more specific questions about their technical skills and experience."
        else:
            return "Let's explore this topic in more depth with follow-up questions."
    
    async def log_supervisor_action(self, action: str, reasoning: str, analysis: Optional[Dict[str, Any]]):
        """Log supervisor action for tracking and debugging"""
        action_log = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "reasoning": reasoning,
            "analysis": analysis,
            "interview_elapsed_minutes": (time.time() - self.interview_start_time) / 60,
            "analysis_count": self.analysis_count
        }
        
        self.actions_taken.append(action_log)
        
        # Add to interview transcript for database storage
        if self.interview_manager:
            self.interview_manager.add_to_transcript(
                "system",
                f"Supervisor action: {action} - {reasoning}",
                "supervisor"
            )
    
    def get_supervisor_stats(self) -> Dict[str, Any]:
        """Get supervisor statistics"""
        return {
            "is_active": self.is_active,
            "analysis_count": self.analysis_count,
            "actions_taken": len(self.actions_taken),
            "conclusion_initiated": self.conclusion_initiated,
            "elapsed_minutes": (time.time() - self.interview_start_time) / 60,
            "recent_actions": self.actions_taken[-5:] if self.actions_taken else []
        }
