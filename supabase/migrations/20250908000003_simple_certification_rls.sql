-- Temporarily disable RLS and create simpler policies for employee_certifications

-- Disable RLS temporarily
ALTER TABLE public.employee_certifications DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "certifications_select_policy" ON public.employee_certifications;
DROP POLICY IF EXISTS "certifications_insert_policy" ON public.employee_certifications;
DROP POLICY IF EXISTS "certifications_update_policy" ON public.employee_certifications;
DROP POLICY IF EXISTS "certifications_delete_policy" ON public.employee_certifications;

-- Re-enable RLS
ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;

-- Create very simple policies that allow all authenticated users
CREATE POLICY "allow_all_authenticated_select" ON public.employee_certifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_all_authenticated_insert" ON public.employee_certifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_all_authenticated_update" ON public.employee_certifications
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_all_authenticated_delete" ON public.employee_certifications
  FOR DELETE USING (auth.uid() IS NOT NULL);
