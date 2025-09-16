-- Add gender field to xlsmart_employees table for pay equity analysis
ALTER TABLE public.xlsmart_employees 
ADD COLUMN gender TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say'));

-- Add index for gender-based queries
CREATE INDEX idx_xlsmart_employees_gender ON xlsmart_employees(gender);

-- Add comment for documentation
COMMENT ON COLUMN xlsmart_employees.gender IS 'Employee gender for diversity and pay equity analysis';
