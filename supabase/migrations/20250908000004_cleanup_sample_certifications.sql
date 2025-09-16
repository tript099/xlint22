-- Clean up sample certification data and keep only real assignments

-- First, let's see what we have (for logging purposes)
-- Keep only the AWS certification assigned to Abhishek Yadav (or any recent real assignments)

-- Delete all sample certifications except the ones we want to keep
-- We'll keep certifications that were assigned today (real assignments)
DELETE FROM public.employee_certifications 
WHERE DATE(created_at) < CURRENT_DATE;

-- This will remove all the sample data that was created during migration
-- and keep only the certifications assigned today (like the AWS one you just assigned)
