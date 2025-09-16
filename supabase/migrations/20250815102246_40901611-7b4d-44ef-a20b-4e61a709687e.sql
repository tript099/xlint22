-- Update RLS policy to allow edge functions to insert without auth context
DROP POLICY IF EXISTS "Authenticated users can create AI analyses" ON public.ai_analysis_results;
DROP POLICY IF EXISTS "Allow service role and authenticated users to create AI analyses" ON public.ai_analysis_results;
DROP POLICY IF EXISTS "Allow service role and authenticated users to create AI analyse" ON public.ai_analysis_results;

CREATE POLICY "Allow service role and authenticated users to create AI analyses"
  ON public.ai_analysis_results
  FOR INSERT
  WITH CHECK (
    -- Allow service role (edge functions)
    (auth.jwt() ->> 'role')::text = 'service_role'
    OR 
    -- Allow authenticated users
    auth.uid() IS NOT NULL
  );

-- Update select policy to allow service role access
DROP POLICY IF EXISTS "Users can view their own AI analyses" ON public.ai_analysis_results;
DROP POLICY IF EXISTS "Users and service role can view AI analyses" ON public.ai_analysis_results;

CREATE POLICY "Users and service role can view AI analyses"
  ON public.ai_analysis_results
  FOR SELECT
  USING (
    -- Allow service role (edge functions)
    (auth.jwt() ->> 'role')::text = 'service_role'
    OR 
    -- Allow users to view their own analyses
    auth.uid() = created_by
    OR
    -- Allow users to view analyses where created_by is null (system generated)
    (created_by IS NULL AND auth.uid() IS NOT NULL)
  );