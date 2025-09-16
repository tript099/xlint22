-- Fix JD table to link directly to standard roles instead of role mappings
ALTER TABLE xlsmart_job_descriptions 
DROP COLUMN IF EXISTS role_mapping_id;

ALTER TABLE xlsmart_job_descriptions 
ADD COLUMN standard_role_id uuid REFERENCES xlsmart_standard_roles(id);

-- Add role_id to employees table to link them directly to standard roles
ALTER TABLE xlsmart_employees 
ADD COLUMN IF NOT EXISTS standard_role_id uuid REFERENCES xlsmart_standard_roles(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_job_descriptions_standard_role ON xlsmart_job_descriptions(standard_role_id);
CREATE INDEX IF NOT EXISTS idx_employees_standard_role ON xlsmart_employees(standard_role_id);