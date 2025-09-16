-- Update the current user's role to hr_manager to allow role standardization
UPDATE public.profiles 
SET role = 'hr_manager'::user_role 
WHERE user_id = auth.uid() AND role = 'candidate'::user_role;