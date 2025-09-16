-- Add missing DELETE policy for xlsmart_upload_sessions
CREATE POLICY "Users can delete their own upload sessions" 
ON public.xlsmart_upload_sessions 
FOR DELETE
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());
