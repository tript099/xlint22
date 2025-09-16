-- Create profile for the current authenticated user
INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
SELECT 
  auth.uid(),
  'deep@simplifyai.id',
  'deep',
  'bhau', 
  'hr_manager'::user_role
WHERE auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid()
  );