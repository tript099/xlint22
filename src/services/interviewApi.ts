// src/services/interviewApi.ts
// API integration for AI Interview system

const getApiUrl = () => import.meta.env.VITE_PYTHON1_API_URL || 'http://localhost:8008';

export interface StartInterviewResponse {
  session_id: string;
  message?: string;
}

export interface FinalizeInterviewRequest {
  interviewId: string;
  transcript: any[];
}

export interface FinalizeInterviewResponse {
  success: boolean;
  message?: string;
  analysis?: any;
}

export class InterviewApiError extends Error {
  constructor(message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = 'InterviewApiError';
  }
}

/**
 * Start a database interview session
 * POST /start-database-interview
 */
export async function startDatabaseInterview(interviewId: string): Promise<StartInterviewResponse> {
  const apiUrl = getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/start-database-interview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        interview_id: interviewId 
      }),
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = { detail: `HTTP ${response.status} ${response.statusText}` };
      }
      
      throw new InterviewApiError(
        errorDetails.detail || errorDetails.message || 'Failed to start interview session',
        response.status,
        errorDetails
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof InterviewApiError) {
      throw error;
    }
    
    // Network or other errors
    throw new InterviewApiError(
      `Network error starting interview: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Finalize interview and save transcript
 * POST /finalize-interview
 */
export async function finalizeInterview(request: FinalizeInterviewRequest): Promise<FinalizeInterviewResponse> {
  const apiUrl = getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/finalize-interview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = { detail: `HTTP ${response.status} ${response.statusText}` };
      }
      
      throw new InterviewApiError(
        errorDetails.detail || errorDetails.message || 'Failed to finalize interview',
        response.status,
        errorDetails
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof InterviewApiError) {
      throw error;
    }
    
    // Network or other errors
    throw new InterviewApiError(
      `Network error finalizing interview: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Check API health/connectivity
 * GET /health
 */
export async function checkApiHealth(): Promise<{ status: string; timestamp: string }> {
  const apiUrl = getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new InterviewApiError(`API health check failed: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof InterviewApiError) {
      throw error;
    }
    
    throw new InterviewApiError(
      `API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}