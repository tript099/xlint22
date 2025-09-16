-- Update RLS policy for xlsmart_job_descriptions to allow authenticated users to view published job descriptions
DROP POLICY IF EXISTS "Job descriptions access policy" ON public.xlsmart_job_descriptions;

-- Create separate policies for better access control
CREATE POLICY "Users can view published job descriptions" 
ON public.xlsmart_job_descriptions 
FOR SELECT 
USING (
  (status = 'published') OR 
  (auth.uid() IS NOT NULL AND get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])) OR
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
);

CREATE POLICY "Authorized users can manage job descriptions" 
ON public.xlsmart_job_descriptions 
FOR ALL 
USING (
  (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])) OR
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
)
WITH CHECK (
  (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])) OR
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
);