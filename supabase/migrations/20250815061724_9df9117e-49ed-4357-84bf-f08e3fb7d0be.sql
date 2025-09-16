-- Add RLS policy to allow service role access for edge functions
CREATE POLICY "Service role can access job descriptions for AI analysis" 
ON public.xlsmart_job_descriptions 
FOR SELECT 
USING (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Keep existing policy for regular users
  get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
);