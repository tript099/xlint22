-- Fix file format constraint to allow xlsx
ALTER TABLE xlsmart_role_catalogs DROP CONSTRAINT xlsmart_role_catalogs_file_format_check;

-- Add updated constraint that includes xlsx
ALTER TABLE xlsmart_role_catalogs ADD CONSTRAINT xlsmart_role_catalogs_file_format_check 
CHECK (file_format = ANY (ARRAY['excel'::text, 'xlsx'::text, 'csv'::text, 'json'::text]));