-- First, update any invalid status values
UPDATE xlsmart_upload_sessions 
SET status = 'completed' 
WHERE status NOT IN ('uploading', 'processing', 'completed', 'error');

-- Now drop and recreate the constraint
ALTER TABLE xlsmart_upload_sessions DROP CONSTRAINT IF EXISTS xlsmart_upload_sessions_status_check;

-- Add the correct constraint that includes 'processing' status
ALTER TABLE xlsmart_upload_sessions ADD CONSTRAINT xlsmart_upload_sessions_status_check 
  CHECK (status IN ('uploading', 'processing', 'completed', 'error'));