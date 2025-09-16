-- Check current RLS policy for xlsmart_upload_sessions
-- The issue is likely that the user doesn't have 'hr_manager' or 'super_admin' role

-- Let's update the policy to allow authenticated users to create sessions
DROP POLICY IF EXISTS "HR managers can manage upload sessions" ON public.xlsmart_upload_sessions;

CREATE POLICY "Authenticated users can create upload sessions" 
ON public.xlsmart_upload_sessions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can view their own upload sessions" 
ON public.xlsmart_upload_sessions 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can update their own upload sessions" 
ON public.xlsmart_upload_sessions 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND created_by = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Also update the policies for the role data tables to allow authenticated users
DROP POLICY IF EXISTS "HR managers can manage XL roles data" ON public.xl_roles_data;
DROP POLICY IF EXISTS "HR managers can manage SMART roles data" ON public.smart_roles_data;

CREATE POLICY "Authenticated users can manage XL roles data" 
ON public.xl_roles_data 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage SMART roles data" 
ON public.smart_roles_data 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);