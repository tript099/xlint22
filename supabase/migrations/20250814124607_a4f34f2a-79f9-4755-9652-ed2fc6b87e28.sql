-- Update the check constraint to be case-insensitive and allow more company variations
ALTER TABLE xlsmart_employees DROP CONSTRAINT xlsmart_employees_source_company_check;

-- Add a more flexible constraint that handles case variations
ALTER TABLE xlsmart_employees ADD CONSTRAINT xlsmart_employees_source_company_check 
CHECK (lower(source_company) = ANY (ARRAY['xl'::text, 'smart'::text, 'unknown'::text]));