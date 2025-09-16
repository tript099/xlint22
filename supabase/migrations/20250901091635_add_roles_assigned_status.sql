-- Add 'roles_assigned' as a valid status for upload sessions
ALTER TABLE xlsmart_upload_sessions DROP CONSTRAINT IF EXISTS xlsmart_upload_sessions_status_check;

-- Add the updated constraint that includes 'roles_assigned' status
ALTER TABLE xlsmart_upload_sessions ADD CONSTRAINT xlsmart_upload_sessions_status_check 
  CHECK (status IN ('uploading', 'processing', 'completed', 'error', 'roles_assigned'));
