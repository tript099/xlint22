-- Fix the status of sessions that have data uploaded but are stuck at 'uploading'
UPDATE xlsmart_upload_sessions 
SET status = 'completed',
    ai_analysis = COALESCE(ai_analysis, '{}') || jsonb_build_object('step', 'upload_complete_fixed', 'fixed_at', NOW())
WHERE status = 'uploading' 
  AND id IN (
    SELECT DISTINCT session_id 
    FROM xl_roles_data 
    WHERE session_id IN (
      SELECT id 
      FROM xlsmart_upload_sessions 
      WHERE status = 'uploading'
    )
  );