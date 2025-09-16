-- Create tables for XL and SMART role data with the exact format provided
CREATE TABLE IF NOT EXISTS public.xl_roles_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  role_id TEXT,
  department TEXT,
  role_family TEXT,
  role_title TEXT NOT NULL,
  seniority_band TEXT,
  role_purpose TEXT,
  core_responsibilities TEXT,
  required_skills TEXT,
  preferred_skills TEXT,
  certifications TEXT,
  tools_platforms TEXT,
  experience_min_years INTEGER,
  education TEXT,
  location TEXT,
  role_variant TEXT,
  alternate_titles TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smart_roles_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  role_id TEXT,
  department TEXT,
  role_family TEXT,
  role_title TEXT NOT NULL,
  seniority_band TEXT,
  role_purpose TEXT,
  core_responsibilities TEXT,
  required_skills TEXT,
  preferred_skills TEXT,
  certifications TEXT,
  tools_platforms TEXT,
  experience_min_years INTEGER,
  education TEXT,
  location TEXT,
  role_variant TEXT,
  alternate_titles TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.xl_roles_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_roles_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "HR managers can manage XL roles data" 
ON public.xl_roles_data 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));

CREATE POLICY "HR managers can manage SMART roles data" 
ON public.smart_roles_data 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Create final standardized roles table
CREATE TABLE IF NOT EXISTS public.standardized_roles_final (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  standardized_role_title TEXT NOT NULL,
  standardized_department TEXT,
  standardized_role_family TEXT,
  standardized_seniority_band TEXT,
  standardized_role_purpose TEXT,
  standardized_core_responsibilities TEXT,
  standardized_required_skills TEXT,
  standardized_preferred_skills TEXT,
  standardized_certifications TEXT,
  standardized_tools_platforms TEXT,
  standardized_experience_min_years INTEGER,
  standardized_education TEXT,
  standardized_location TEXT,
  xl_source_count INTEGER DEFAULT 0,
  smart_source_count INTEGER DEFAULT 0,
  confidence_score NUMERIC DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for final table
ALTER TABLE public.standardized_roles_final ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR managers can manage standardized roles final" 
ON public.standardized_roles_final 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Create role mappings table to track which original roles map to which standardized roles
CREATE TABLE IF NOT EXISTS public.role_standardization_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  original_role_id TEXT,
  original_role_title TEXT NOT NULL,
  original_source TEXT NOT NULL CHECK (original_source IN ('xl', 'smart')),
  standardized_role_id UUID NOT NULL REFERENCES public.standardized_roles_final(id),
  mapping_confidence NUMERIC DEFAULT 0.0,
  mapping_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_standardization_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR managers can manage role mappings" 
ON public.role_standardization_mappings 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));