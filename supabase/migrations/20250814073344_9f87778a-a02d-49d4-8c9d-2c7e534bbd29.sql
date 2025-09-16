-- Add the constraint back now that data is cleaned
ALTER TABLE xlsmart_role_catalogs ADD CONSTRAINT xlsmart_role_catalogs_source_company_check 
CHECK (source_company = ANY (ARRAY['XL Axiata'::text, 'Smartfren'::text, 'XL Axiata + Smartfren'::text, 'External'::text]));

-- Fix the function search path issues
ALTER FUNCTION public.drop_temp_tables(text[]) SET search_path TO 'public';
ALTER FUNCTION public.handle_new_user() SET search_path TO 'public';