-- Drop the problematic policy we just created
DROP POLICY IF EXISTS "Service role can access job descriptions for AI analysis" ON public.xlsmart_job_descriptions;

-- Update the existing policy to include service role access
DROP POLICY IF EXISTS "HR managers can manage job descriptions" ON public.xlsmart_job_descriptions;

-- Create a comprehensive policy that allows both user access and service role access
CREATE POLICY "Job descriptions access policy" 
ON public.xlsmart_job_descriptions 
FOR ALL
USING (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow HR managers and super admins
  get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
)
WITH CHECK (
  -- Same check for inserts/updates
  auth.jwt() ->> 'role' = 'service_role' OR
  get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
);