#!/usr/bin/env python3
"""
AI Interview Supervisor Test Script

This script tests the supervisor functionality by simulating interview scenarios
and verifying that the supervisor takes appropriate actions.
"""

import asyncio
import json
import time
from datetime import datetime
import httpx
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SupervisorTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def test_supervisor_integration(self):
        """Test complete supervisor integration"""
        print("🧪 Testing AI Interview Supervisor Integration")
        print("=" * 50)
        
        try:
            # Test 1: Health check with supervisor stats
            await self.test_health_check()
            
            # Test 2: Create interview session
            session_id = await self.test_create_interview()
            
            if session_id:
                # Test 3: Check supervisor status
                await self.test_supervisor_status(session_id)
                
                # Test 4: Manual supervisor actions
                await self.test_manual_actions(session_id)
                
                # Test 5: Simulate supervisor monitoring
                await self.test_supervisor_monitoring(session_id)
                
                # Test 6: Clean up
                await self.test_cleanup(session_id)
            
            print("\n✅ All supervisor tests completed!")
            
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            logger.error(f"Test error: {e}")
        finally:
            await self.client.aclose()
    
    async def test_health_check(self):
        """Test health endpoint with supervisor stats"""
        print("\n1. Testing Health Check with Supervisor Stats")
        
        response = await self.client.get(f"{self.base_url}/health")
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ Health check passed")
            print(f"   ✅ Supervisor enabled: {health_data.get('supervisor_enabled', False)}")
            print(f"   ✅ Active supervisors: {health_data.get('supervisor_stats', {}).get('active_supervisors', 0)}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            
    async def test_create_interview(self):
        """Test interview creation with supervisor"""
        print("\n2. Testing Interview Creation")
        
        interview_data = {
            "job_description": "Senior Python Developer with FastAPI experience. Must have strong problem-solving skills and experience with real-time systems.",
            "resume_text": "John Doe - 5 years Python developer, FastAPI expert, built WebSocket applications, strong in system design.",
            "candidate_name": "John Doe"
        }
        
        response = await self.client.post(
            f"{self.base_url}/start-interview",
            json=interview_data
        )
        
        if response.status_code == 200:
            session_data = response.json()
            session_id = session_data.get("session_id")
            print(f"   ✅ Interview created: {session_id}")
            return session_id
        else:
            print(f"   ❌ Interview creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    
    async def test_supervisor_status(self, session_id):
        """Test supervisor status endpoint"""
        print("\n3. Testing Supervisor Status")
        
        # Wait a moment for supervisor to initialize
        await asyncio.sleep(2)
        
        response = await self.client.get(f"{self.base_url}/session/{session_id}/supervisor")
        
        if response.status_code == 200:
            supervisor_data = response.json()
            stats = supervisor_data.get("supervisor_stats", {})
            print(f"   ✅ Supervisor status retrieved")
            print(f"   ✅ Supervisor active: {stats.get('is_active', False)}")
            print(f"   ✅ Analysis count: {stats.get('analysis_count', 0)}")
            print(f"   ✅ Actions taken: {stats.get('actions_taken', 0)}")
        else:
            print(f"   ❌ Supervisor status failed: {response.status_code}")
    
    async def test_manual_actions(self, session_id):
        """Test manual supervisor actions"""
        print("\n4. Testing Manual Supervisor Actions")
        
        # Test guidance action
        guidance_data = {
            "action": "guide",
            "message": "Let's focus on the candidate's FastAPI experience and real-time system design skills."
        }
        
        response = await self.client.post(
            f"{self.base_url}/session/{session_id}/supervisor/action",
            json=guidance_data
        )
        
        if response.status_code == 200:
            print(f"   ✅ Manual guidance action successful")
        else:
            print(f"   ❌ Manual guidance action failed: {response.status_code}")
        
        # Wait and test conclude action
        await asyncio.sleep(2)
        
        conclude_data = {
            "action": "conclude",
            "message": "We've covered the technical aspects well. Let's wrap up with final questions."
        }
        
        response = await self.client.post(
            f"{self.base_url}/session/{session_id}/supervisor/action",
            json=conclude_data
        )
        
        if response.status_code == 200:
            print(f"   ✅ Manual conclude action successful")
        else:
            print(f"   ❌ Manual conclude action failed: {response.status_code}")
    
    async def test_supervisor_monitoring(self, session_id):
        """Test supervisor monitoring over time"""
        print("\n5. Testing Supervisor Monitoring (30 seconds)")
        
        start_time = time.time()
        
        # Monitor for 35 seconds to see supervisor analysis cycles
        while time.time() - start_time < 35:
            response = await self.client.get(f"{self.base_url}/session/{session_id}/supervisor")
            
            if response.status_code == 200:
                supervisor_data = response.json()
                stats = supervisor_data.get("supervisor_stats", {})
                elapsed = stats.get("elapsed_minutes", 0)
                analysis_count = stats.get("analysis_count", 0)
                actions_taken = stats.get("actions_taken", 0)
                
                print(f"   📊 Elapsed: {elapsed:.1f}min, Analyses: {analysis_count}, Actions: {actions_taken}")
                
                # Check for recent actions
                recent_actions = stats.get("recent_actions", [])
                if recent_actions:
                    latest_action = recent_actions[-1]
                    action_type = latest_action.get("action", "unknown")
                    print(f"   🎯 Latest action: {action_type}")
            
            await asyncio.sleep(5)  # Check every 5 seconds
        
        print(f"   ✅ Monitoring test completed")
    
    async def test_transcript_with_supervisor(self, session_id):
        """Test transcript endpoint with supervisor stats"""
        print("\n6. Testing Enhanced Transcript")
        
        response = await self.client.get(f"{self.base_url}/session/{session_id}/transcript")
        
        if response.status_code == 200:
            transcript_data = response.json()
            supervisor_stats = transcript_data.get("supervisor_stats", {})
            live_transcript = transcript_data.get("live_transcript", [])
            
            print(f"   ✅ Enhanced transcript retrieved")
            print(f"   ✅ Transcript entries: {len(live_transcript)}")
            print(f"   ✅ Supervisor analyses: {supervisor_stats.get('analysis_count', 0)}")
            
            # Look for supervisor entries in transcript
            supervisor_entries = [entry for entry in live_transcript if entry.get("type") == "supervisor"]
            print(f"   ✅ Supervisor entries in transcript: {len(supervisor_entries)}")
        else:
            print(f"   ❌ Enhanced transcript failed: {response.status_code}")
    
    async def test_cleanup(self, session_id):
        """Test interview cleanup"""
        print("\n7. Testing Interview Cleanup")
        
        response = await self.client.delete(f"{self.base_url}/session/{session_id}")
        
        if response.status_code == 200:
            cleanup_data = response.json()
            print(f"   ✅ Interview ended successfully")
            print(f"   ✅ Session ID: {cleanup_data.get('session_id', 'unknown')}")
        else:
            print(f"   ❌ Interview cleanup failed: {response.status_code}")
    
    async def simulate_long_interview(self):
        """Simulate a long interview to test auto-conclusion"""
        print("\n🎭 Simulating Long Interview Scenario")
        
        # Create interview
        session_id = await self.test_create_interview()
        if not session_id:
            return
        
        print(f"   📝 Monitoring supervisor for auto-conclusion behavior...")
        
        # Monitor for supervisor actions over time
        start_time = time.time()
        
        while time.time() - start_time < 120:  # Monitor for 2 minutes
            response = await self.client.get(f"{self.base_url}/session/{session_id}/supervisor")
            
            if response.status_code == 200:
                supervisor_data = response.json()
                stats = supervisor_data.get("supervisor_stats", {})
                
                if stats.get("conclusion_initiated"):
                    print(f"   🎯 Supervisor initiated conclusion!")
                    break
            
            await asyncio.sleep(10)
        
        # Cleanup
        await self.client.delete(f"{self.base_url}/session/{session_id}")

async def main():
    """Run all supervisor tests"""
    tester = SupervisorTester()
    
    print("🧠 AI Interview Supervisor Test Suite")
    print("====================================")
    print("This will test the supervisor functionality.")
    print("Make sure the server is running on localhost:8000")
    print()
    
    # Test basic integration
    await tester.test_supervisor_integration()
    
    print("\n" + "="*50)
    print("🎭 Advanced Testing")
    
    # Test long interview scenario
    await tester.simulate_long_interview()
    
    print("\n🎉 All tests completed!")

if __name__ == "__main__":
    asyncio.run(main())
