// src/services/interviewDatabase.ts
// Database integration for AI Interview system using existing Supabase tables

import { supabase } from '@/integrations/supabase/client';

export interface InterviewSession {
  id: string;
  employee_id: string;
  job_description_id: string;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  job_requirements?: string;
  interview_notes?: string;
  transcript?: any;
  ai_analysis?: any;
  overall_score?: number;
  skill_scores?: any;
  recommendations?: string[];
  strengths?: string[];
  areas_for_improvement?: string[];
  created_by?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  interview_type: 'role_assessment' | 'promotion' | 'performance_review' | 'skill_evaluation';
  created_at: string;
  updated_at: string;
}

export interface InterviewQuestion {
  id: string;
  interview_session_id: string;
  question_text: string;
  question_category?: string;
  ai_response?: string;
  employee_response?: string;
  response_score?: number;
  response_analysis?: any;
  asked_at: string;
  created_at: string;
}

export class InterviewDatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'InterviewDatabaseError';
  }
}

/**
 * Get interview session by ID
 */
export async function getInterviewSession(sessionId: string): Promise<InterviewSession | null> {
  try {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new InterviewDatabaseError(`Failed to get interview session: ${error.message}`, error);
    }

    return data;
  } catch (error) {
    if (error instanceof InterviewDatabaseError) {
      throw error;
    }
    throw new InterviewDatabaseError(`Database error getting interview session: ${error}`, error);
  }
}

/**
 * Update interview session status to in_progress and set started_at
 */
export async function startInterviewSession(sessionId: string): Promise<InterviewSession> {
  try {
    const { data, error } = await supabase
      .from('interview_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new InterviewDatabaseError(`Failed to start interview session: ${error.message}`, error);
    }

    return data;
  } catch (error) {
    if (error instanceof InterviewDatabaseError) {
      throw error;
    }
    throw new InterviewDatabaseError(`Database error starting interview session: ${error}`, error);
  }
}

/**
 * Complete interview session with transcript and analysis
 */
export async function completeInterviewSession(
  sessionId: string,
  transcript: any,
  analysis?: any,
  score?: number,
  duration?: number
): Promise<InterviewSession> {
  try {
    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      transcript: transcript,
      updated_at: new Date().toISOString()
    };

    if (analysis) updateData.ai_analysis = analysis;
    if (score !== undefined) updateData.overall_score = score;
    if (duration !== undefined) updateData.duration_minutes = duration;

    const { data, error } = await supabase
      .from('interview_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new InterviewDatabaseError(`Failed to complete interview session: ${error.message}`, error);
    }

    return data;
  } catch (error) {
    if (error instanceof InterviewDatabaseError) {
      throw error;
    }
    throw new InterviewDatabaseError(`Database error completing interview session: ${error}`, error);
  }
}

/**
 * Add interview question and response
 */
export async function addInterviewQuestion(
  sessionId: string,
  questionText: string,
  questionCategory?: string,
  aiResponse?: string,
  employeeResponse?: string,
  responseScore?: number,
  responseAnalysis?: any
): Promise<InterviewQuestion> {
  try {
    const { data, error } = await supabase
      .from('interview_questions')
      .insert({
        interview_session_id: sessionId,
        question_text: questionText,
        question_category: questionCategory,
        ai_response: aiResponse,
        employee_response: employeeResponse,
        response_score: responseScore,
        response_analysis: responseAnalysis,
        asked_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new InterviewDatabaseError(`Failed to add interview question: ${error.message}`, error);
    }

    return data;
  } catch (error) {
    if (error instanceof InterviewDatabaseError) {
      throw error;
    }
    throw new InterviewDatabaseError(`Database error adding interview question: ${error}`, error);
  }
}

/**
 * Get all questions for an interview session
 */
export async function getInterviewQuestions(sessionId: string): Promise<InterviewQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('interview_session_id', sessionId)
      .order('asked_at', { ascending: true });

    if (error) {
      throw new InterviewDatabaseError(`Failed to get interview questions: ${error.message}`, error);
    }

    return data || [];
  } catch (error) {
    if (error instanceof InterviewDatabaseError) {
      throw error;
    }
    throw new InterviewDatabaseError(`Database error getting interview questions: ${error}`, error);
  }
}

/**
 * Calculate overall score from individual question scores
 */
export async function calculateOverallScore(sessionId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('interview_questions')
      .select('response_score')
      .eq('interview_session_id', sessionId)
      .not('response_score', 'is', null);

    if (error) {
      throw new InterviewDatabaseError(`Failed to calculate overall score: ${error.message}`, error);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const scores = data.map(q => q.response_score).filter(score => score !== null);
    if (scores.length === 0) {
      return null;
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average);
  } catch (error) {
    if (error instanceof InterviewDatabaseError) {
      throw error;
    }
    throw new InterviewDatabaseError(`Database error calculating overall score: ${error}`, error);
  }
}

/**
 * Ensure required indexes exist (run once during setup)
 */
export async function ensureIndexes(): Promise<void> {
  try {
    // Note: In production, these should be run as migrations
    // This is just for development/verification
    const queries = [
      'CREATE INDEX IF NOT EXISTS idx_isessions_employee ON public.interview_sessions(employee_id);',
      'CREATE INDEX IF NOT EXISTS idx_iquestions_session ON public.interview_questions(interview_session_id);'
    ];

    for (const query of queries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) {
        console.warn(`Index creation warning: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn('Could not verify indexes - this is normal in production:', error);
  }
}