// AI Interview API Service
// Handles communication between XLSMART and the AI Interviewer backend

import { supabase } from "@/integrations/supabase/client";

// Configuration for AI Interviewer backend
const AI_INTERVIEWER_CONFIG = {
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-ai-interviewer-domain.com' 
    : 'http://localhost:8008',
  endpoints: {
    startInterview: '/start-interview',
    startDatabaseInterview: '/start-database-interview', // For database-connected interviews
    finalizeInterview: '/finalize-interview',
    getReport: '/get-interview-report'
  }
};

// Types for API communication
export interface AIInterviewRequest {
  employee_id: string;
  job_description_id: string;
  interview_type?: 'role_assessment' | 'promotion' | 'performance_review' | 'skill_evaluation';
  interview_notes?: string;
}

export interface AIInterviewSession {
  session_id: string;
  interview_id?: string;
  websocket_url: string;
  status: 'created' | 'active' | 'completed' | 'error';
  employee_name?: string;
  candidate_name?: string;
  message?: string;
}

export interface InterviewRequest {
  job_description: string;
  resume_text: string;
  candidate_name?: string;
}

export class AIInterviewService {
  private static instance: AIInterviewService;
  
  public static getInstance(): AIInterviewService {
    if (!AIInterviewService.instance) {
      AIInterviewService.instance = new AIInterviewService();
    }
    return AIInterviewService.instance;
  }

  /**
   * Schedule a new AI interview session
   */
  async scheduleInterview(request: AIInterviewRequest): Promise<string> {
    try {
      // Get employee and job description data
      const { data: employee } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('id', request.employee_id)
        .single();

      const { data: jobDescription } = await supabase
        .from('xlsmart_job_descriptions')
        .select('*')
        .eq('id', request.job_description_id)
        .single();

      if (!employee || !jobDescription) {
        throw new Error('Employee or job description not found');
      }

      // Create interview session record
      const { data: session, error } = await supabase
        .from('interview_sessions')
        .insert([
          {
            employee_id: request.employee_id,
            job_description_id: request.job_description_id,
            status: 'scheduled',
            scheduled_at: new Date().toISOString(),
            interview_type: request.interview_type || 'role_assessment',
            interview_notes: request.interview_notes,
            duration_minutes: 30 // Default 30 minutes duration
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return session.id;
    } catch (error) {
      console.error('Error scheduling interview:', error);
      throw error;
    }
  }

  /**
   * Start an AI interview session with the real AI interviewer backend
   */
  async startInterview(interviewSessionId: string): Promise<AIInterviewSession> {
    try {
      // Call the database interview endpoint with just the interview ID
      const response = await fetch(`${AI_INTERVIEWER_CONFIG.baseUrl}${AI_INTERVIEWER_CONFIG.endpoints.startDatabaseInterview}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interview_id: interviewSessionId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Interviewer backend error:', errorText);
        throw new Error(`AI Interviewer backend error: ${response.status} - ${errorText}`);
      }

      const aiSession: AIInterviewSession = await response.json();

      // The backend will handle updating the database status
      return {
        ...aiSession,
        interview_id: interviewSessionId,
        websocket_url: `ws://localhost:8008${aiSession.websocket_url}`
      };
    } catch (error) {
      console.error('Error starting interview:', error);
      
      // Update session status to error
      await supabase
        .from('interview_sessions')
        .update({ status: 'cancelled' })
        .eq('id', interviewSessionId);
      
      throw error;
    }
  }

  /**
   * End an AI interview session
   */
  async endInterview(interviewSessionId: string, aiSessionId: string): Promise<void> {
    try {
      // Finalize the interview in the AI backend
      await fetch(`${AI_INTERVIEWER_CONFIG.baseUrl}${AI_INTERVIEWER_CONFIG.endpoints.finalizeInterview}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: aiSessionId,
          transcript: []
        })
      });

      // Update our session as completed
      await supabase
        .from('interview_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', interviewSessionId);

    } catch (error) {
      console.error('Error ending interview:', error);
      throw error;
    }
  }

  /**
   * Get all interview sessions from database
   */
  async getInterviewSessions() {
    try {
      const { data: sessions, error } = await supabase
        .from('interview_sessions')
        .select(`
          *,
          xlsmart_employees!interview_sessions_employee_id_fkey (
            id,
            first_name,
            last_name,
            current_position,
            current_department
          ),
          xlsmart_job_descriptions!interview_sessions_job_description_id_fkey (
            id,
            title,
            summary
          )
        `)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      // Transform data for frontend display
      return sessions?.map(session => ({
        id: session.id,
        employee: session.xlsmart_employees ? {
          id: session.xlsmart_employees.id,
          first_name: session.xlsmart_employees.first_name,
          last_name: session.xlsmart_employees.last_name,
          current_position: session.xlsmart_employees.current_position,
          current_department: session.xlsmart_employees.current_department
        } : null,
        job_description: session.xlsmart_job_descriptions ? {
          id: session.xlsmart_job_descriptions.id,
          title: session.xlsmart_job_descriptions.title,
          summary: session.xlsmart_job_descriptions.summary,
          department: 'HR Department' // Add default department
        } : null,
        status: session.status,
        scheduled_at: session.scheduled_at,
        started_at: session.started_at,
        completed_at: session.completed_at,
        duration_minutes: session.duration_minutes,
        overall_score: session.overall_score,
        interview_type: session.interview_type,
        interview_notes: session.interview_notes
      })) || [];
    } catch (error) {
      console.error('Error fetching interview sessions:', error);
      throw error;
    }
  }

  /**
   * Get WebSocket URL for real-time interview connection
   */
  getWebSocketUrl(sessionId: string): string {
    return `ws://localhost:8008/ws/interview/${sessionId}`;
  }
}

// Export singleton instance
export const aiInterviewService = AIInterviewService.getInstance();