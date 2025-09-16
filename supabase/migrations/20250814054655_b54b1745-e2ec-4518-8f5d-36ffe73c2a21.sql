-- Clean up temporary and test data
TRUNCATE TABLE xl_roles_data CASCADE;
TRUNCATE TABLE smart_roles_data CASCADE;
TRUNCATE TABLE xlsmart_role_mappings CASCADE;
TRUNCATE TABLE xlsmart_standard_roles CASCADE;
TRUNCATE TABLE xlsmart_employees CASCADE;
TRUNCATE TABLE xlsmart_job_descriptions CASCADE;
TRUNCATE TABLE standardized_roles_final CASCADE;
TRUNCATE TABLE role_standardization_mappings CASCADE;
TRUNCATE TABLE xlsmart_upload_sessions CASCADE;

-- Add unique constraints to prevent duplicates

-- Prevent duplicate standard roles based on title, department, and level
ALTER TABLE xlsmart_standard_roles 
ADD CONSTRAINT unique_standard_role 
UNIQUE (role_title, department, role_level);

-- Prevent duplicate employees based on employee number and source company
ALTER TABLE xlsmart_employees 
ADD CONSTRAINT unique_employee_per_company 
UNIQUE (employee_number, source_company);

-- Prevent duplicate job descriptions based on title and standard role
ALTER TABLE xlsmart_job_descriptions 
ADD CONSTRAINT unique_job_description 
UNIQUE (title, standard_role_id);

-- Prevent duplicate role mappings
ALTER TABLE xlsmart_role_mappings 
ADD CONSTRAINT unique_role_mapping 
UNIQUE (original_role_title, original_department, standardized_role_title);

-- Prevent duplicate upload sessions with same name from same user
ALTER TABLE xlsmart_upload_sessions 
ADD CONSTRAINT unique_session_per_user 
UNIQUE (session_name, created_by);

-- Add index for better performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_standard_roles_title ON xlsmart_standard_roles(role_title);
CREATE INDEX IF NOT EXISTS idx_employees_email ON xlsmart_employees(email);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_title ON xlsmart_job_descriptions(title);
CREATE INDEX IF NOT EXISTS idx_role_mappings_original ON xlsmart_role_mappings(original_role_title);

-- Clean up any potential orphaned data
DELETE FROM xlsmart_role_mappings WHERE standard_role_id IS NOT NULL 
  AND standard_role_id NOT IN (SELECT id FROM xlsmart_standard_roles);

DELETE FROM xlsmart_job_descriptions WHERE standard_role_id IS NOT NULL 
  AND standard_role_id NOT IN (SELECT id FROM xlsmart_standard_roles);

DELETE FROM xlsmart_employees WHERE standard_role_id IS NOT NULL 
  AND standard_role_id NOT IN (SELECT id FROM xlsmart_standard_roles);