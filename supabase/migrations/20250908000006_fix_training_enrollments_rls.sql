-- Fix RLS policies for employee_training_enrollments to allow HR managers to see all data

-- Drop existing policies
DROP POLICY IF EXISTS "enrollments_select_policy" ON public.employee_training_enrollments;
DROP POLICY IF EXISTS "enrollments_insert_policy" ON public.employee_training_enrollments;

-- Create more permissive select policy for HR managers
CREATE POLICY "enrollments_select_policy" ON public.employee_training_enrollments
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
  );

-- Create more permissive insert policy for HR managers
CREATE POLICY "enrollments_insert_policy" ON public.employee_training_enrollments
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
  );

-- Add update and delete policies as well
CREATE POLICY "enrollments_update_policy" ON public.employee_training_enrollments
  FOR UPDATE USING (
    auth.role() = 'service_role' OR 
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
  );

CREATE POLICY "enrollments_delete_policy" ON public.employee_training_enrollments
  FOR DELETE USING (
    auth.role() = 'service_role' OR 
    get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text])
  );
