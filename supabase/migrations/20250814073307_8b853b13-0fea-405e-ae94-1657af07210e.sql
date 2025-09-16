-- Drop the constraint completely first
ALTER TABLE xlsmart_role_catalogs DROP CONSTRAINT IF EXISTS xlsmart_role_catalogs_source_company_check;

-- Update existing rows with invalid source_company values
UPDATE xlsmart_role_catalogs 
SET source_company = 'XL Axiata + Smartfren' 
WHERE source_company = 'both' OR source_company NOT IN ('XL Axiata', 'Smartfren', 'External');