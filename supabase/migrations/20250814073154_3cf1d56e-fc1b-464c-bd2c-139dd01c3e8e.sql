-- Fix source_company constraint to allow the combined company name
ALTER TABLE xlsmart_role_catalogs DROP CONSTRAINT IF EXISTS xlsmart_role_catalogs_source_company_check;

-- Add updated constraint that includes the combined company name
ALTER TABLE xlsmart_role_catalogs ADD CONSTRAINT xlsmart_role_catalogs_source_company_check 
CHECK (source_company = ANY (ARRAY['XL Axiata'::text, 'Smartfren'::text, 'XL Axiata + Smartfren'::text, 'External'::text]));