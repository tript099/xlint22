-- Add unique constraints to prevent duplicates

-- Prevent duplicate employees by email within same company
ALTER TABLE xlsmart_employees 
ADD CONSTRAINT unique_employee_email_per_company 
UNIQUE (email, source_company);

-- Prevent duplicate employee numbers within same company  
ALTER TABLE xlsmart_employees 
ADD CONSTRAINT unique_employee_number_per_company 
UNIQUE (employee_number, source_company);

-- Prevent duplicate skills by name
ALTER TABLE skills_master 
ADD CONSTRAINT unique_skill_name 
UNIQUE (name);

-- Prevent duplicate standard roles by title and level
ALTER TABLE xlsmart_standard_roles 
ADD CONSTRAINT unique_role_title_level 
UNIQUE (role_title, role_level);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_xlsmart_employees_email ON xlsmart_employees(email);
CREATE INDEX IF NOT EXISTS idx_xlsmart_employees_company ON xlsmart_employees(source_company);
CREATE INDEX IF NOT EXISTS idx_skills_master_name ON skills_master(name);
CREATE INDEX IF NOT EXISTS idx_standard_roles_title ON xlsmart_standard_roles(role_title);