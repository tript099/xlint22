-- Update RLS policy to allow viewing system-generated AI analyses
DROP POLICY IF EXISTS "Users and service role can view AI analyses" ON ai_analysis_results;

CREATE POLICY "Users and service role can view AI analyses" 
ON ai_analysis_results 
FOR SELECT 
USING (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR (auth.uid() = created_by) 
  OR ((created_by IS NULL) AND (auth.uid() IS NOT NULL))
  OR ((created_by = '00000000-0000-0000-0000-000000000000'::uuid) AND (auth.uid() IS NOT NULL))
);