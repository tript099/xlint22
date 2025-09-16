-- Add columns to xlsmart_employees table to track role assignment suggestions
ALTER TABLE public.xlsmart_employees 
ADD COLUMN IF NOT EXISTS ai_suggested_role_id uuid REFERENCES public.xlsmart_standard_roles(id),
ADD COLUMN IF NOT EXISTS original_role_title text,
ADD COLUMN IF NOT EXISTS role_assignment_status text DEFAULT 'pending' CHECK (role_assignment_status IN ('pending', 'ai_suggested', 'manually_assigned', 'approved')),
ADD COLUMN IF NOT EXISTS assigned_by uuid,
ADD COLUMN IF NOT EXISTS assignment_notes text;