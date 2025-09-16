-- First update existing rows with invalid source_company values
UPDATE xlsmart_role_catalogs 
SET source_company = 'XL Axiata + Smartfren' 
WHERE source_company NOT IN ('XL Axiata', 'Smartfren', 'External');

-- Drop the constraint if it exists
ALTER TABLE xlsmart_role_catalogs DROP CONSTRAINT IF EXISTS xlsmart_role_catalogs_source_company_check;

-- Add updated constraint that includes the combined company name
ALTER TABLE xlsmart_role_catalogs ADD CONSTRAINT xlsmart_role_catalogs_source_company_check 
CHECK (source_company = ANY (ARRAY['XL Axiata'::text, 'Smartfren'::text, 'XL Axiata + Smartfren'::text, 'External'::text]));