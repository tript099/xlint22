-- Make job_description_id nullable for general skill assessments
ALTER TABLE xlsmart_skill_assessments 
ALTER COLUMN job_description_id DROP NOT NULL;

-- Add a comment to explain when this can be null
COMMENT ON COLUMN xlsmart_skill_assessments.job_description_id IS 'Job description ID - can be null for general skill assessments not targeting a specific role';