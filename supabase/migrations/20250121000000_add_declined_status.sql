-- Add 'declined' status to job descriptions table
ALTER TABLE public.xlsmart_job_descriptions 
DROP CONSTRAINT IF EXISTS xlsmart_job_descriptions_status_check;

ALTER TABLE public.xlsmart_job_descriptions 
ADD CONSTRAINT xlsmart_job_descriptions_status_check 
CHECK (status IN ('draft', 'review', 'approved', 'published', 'declined'));
