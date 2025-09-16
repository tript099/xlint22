-- Add agenda column to interview_sessions table for storing meeting agenda
-- This is idempotent and won't fail if the column already exists

ALTER TABLE public.interview_sessions 
ADD COLUMN IF NOT EXISTS agenda JSONB;

-- Add helpful index for interview_questions if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id 
ON public.interview_questions(interview_session_id);

-- Ensure the service role can bypass RLS for writes
-- (This might already be configured but adding for safety)
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Service role should be able to bypass RLS but let's add a policy just in case
-- These policies will only be created if they don't already exist
DO $$
BEGIN
    -- Service role policy for interview_sessions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'interview_sessions' 
        AND policyname = 'service_role_all_access'
    ) THEN
        CREATE POLICY service_role_all_access ON public.interview_sessions
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;

    -- Service role policy for interview_questions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'interview_questions' 
        AND policyname = 'service_role_all_access'
    ) THEN
        CREATE POLICY service_role_all_access ON public.interview_questions
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;