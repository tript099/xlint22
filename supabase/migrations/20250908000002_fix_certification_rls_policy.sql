-- Fix RLS policy for employee_certifications to allow authenticated users to assign certifications

-- Drop existing policies
DROP POLICY IF EXISTS "certifications_insert_policy" ON public.employee_certifications;
DROP POLICY IF EXISTS "certifications_update_policy" ON public.employee_certifications;
DROP POLICY IF EXISTS "certifications_delete_policy" ON public.employee_certifications;

-- Create more permissive insert policy for authenticated users
CREATE POLICY "certifications_insert_policy" ON public.employee_certifications
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.uid() IS NOT NULL -- Allow any authenticated user to assign certifications
  );

-- Create update policy for authenticated users
CREATE POLICY "certifications_update_policy" ON public.employee_certifications
  FOR UPDATE USING (
    auth.role() = 'service_role' OR 
    auth.uid() IS NOT NULL -- Allow any authenticated user to update certifications
  );

-- Create delete policy for authenticated users  
CREATE POLICY "certifications_delete_policy" ON public.employee_certifications
  FOR DELETE USING (
    auth.role() = 'service_role' OR 
    auth.uid() IS NOT NULL -- Allow any authenticated user to delete certifications
  );
