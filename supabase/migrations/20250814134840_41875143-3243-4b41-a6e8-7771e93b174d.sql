-- Update RLS policies for xlsmart_employees to allow authenticated users to read
DROP POLICY IF EXISTS "HR managers can manage employees" ON xlsmart_employees;

CREATE POLICY "Authenticated users can view employees" 
ON xlsmart_employees 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR managers can manage employees" 
ON xlsmart_employees 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Update RLS policies for xlsmart_standard_roles to allow authenticated users to read
DROP POLICY IF EXISTS "HR managers can manage standard roles" ON xlsmart_standard_roles;

CREATE POLICY "Authenticated users can view standard roles" 
ON xlsmart_standard_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR managers can manage standard roles" 
ON xlsmart_standard_roles 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));