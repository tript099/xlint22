-- Fix the RLS policies for xlsmart_employees to allow updates for authenticated users
DROP POLICY IF EXISTS "HR managers can manage employees" ON xlsmart_employees;

-- Allow authenticated users to update employees (for role assignments)
CREATE POLICY "Authenticated users can update employee roles" 
ON xlsmart_employees 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Keep the read policy as is
-- The "Authenticated users can view employees" policy should already exist

-- Also ensure we can insert for those who need it
CREATE POLICY "Authenticated users can insert employees" 
ON xlsmart_employees 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND uploaded_by = auth.uid());