-- Add structured template fields to job descriptions table
ALTER TABLE xlsmart_job_descriptions 
ADD COLUMN IF NOT EXISTS job_identity JSONB,
ADD COLUMN IF NOT EXISTS key_contacts JSONB,
ADD COLUMN IF NOT EXISTS competencies JSONB,
ADD COLUMN IF NOT EXISTS template_version VARCHAR(50) DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS full_description TEXT;

-- Add comments for documentation
COMMENT ON COLUMN xlsmart_job_descriptions.job_identity IS 'Structured job identity information including position, directorate, supervisor, subordinates';
COMMENT ON COLUMN xlsmart_job_descriptions.key_contacts IS 'Internal and external key contacts and relationships';
COMMENT ON COLUMN xlsmart_job_descriptions.competencies IS 'Functional and leadership competencies with proficiency levels';
COMMENT ON COLUMN xlsmart_job_descriptions.template_version IS 'Version of template used for generation';
COMMENT ON COLUMN xlsmart_job_descriptions.full_description IS 'Complete formatted job description text';
