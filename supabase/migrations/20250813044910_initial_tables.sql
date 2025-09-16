-- Create XLSMART Role Catalogs table for bulk uploads
CREATE TABLE public.xlsmart_role_catalogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_company TEXT NOT NULL CHECK (source_company IN ('xl', 'smart', 'both')),
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK (file_format IN ('excel', 'csv', 'json')),
  file_size INTEGER,
  total_roles INTEGER DEFAULT 0,
  processed_roles INTEGER DEFAULT 0,
  mapping_accuracy DECIMAL(5,2),
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create XLSMART Role Mappings table for standardized roles
CREATE TABLE public.xlsmart_role_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID NOT NULL REFERENCES public.xlsmart_role_catalogs(id) ON DELETE CASCADE,
  original_role_title TEXT NOT NULL,
  original_department TEXT,
  original_level TEXT,
  standardized_role_title TEXT NOT NULL,
  standardized_department TEXT,
  standardized_level TEXT,
  job_family TEXT,
  mapping_confidence DECIMAL(5,2) DEFAULT 0.0,
  requires_manual_review BOOLEAN DEFAULT FALSE,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  mapping_status TEXT NOT NULL DEFAULT 'auto_mapped' CHECK (mapping_status IN ('auto_mapped', 'manual_review', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create XLSMART Employees table
CREATE TABLE public.xlsmart_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number TEXT NOT NULL UNIQUE,
  source_company TEXT NOT NULL CHECK (source_company IN ('xl', 'smart')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  current_position TEXT NOT NULL,
  current_department TEXT,
  current_level TEXT,
  hire_date DATE,
  years_of_experience INTEGER,
  salary DECIMAL(12,2),
  currency TEXT DEFAULT 'IDR',
  manager_id UUID REFERENCES public.xlsmart_employees(id),
  skills JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  performance_rating DECIMAL(3,2),
  is_active BOOLEAN DEFAULT TRUE,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create XLSMART Job Descriptions table for AI-generated JDs
CREATE TABLE public.xlsmart_job_descriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_mapping_id UUID NOT NULL REFERENCES public.xlsmart_role_mappings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  responsibilities JSONB DEFAULT '[]'::jsonb,
  required_qualifications JSONB DEFAULT '[]'::jsonb,
  preferred_qualifications JSONB DEFAULT '[]'::jsonb,
  required_skills JSONB DEFAULT '[]'::jsonb,
  preferred_skills JSONB DEFAULT '[]'::jsonb,
  experience_level TEXT,
  education_level TEXT,
  salary_range_min DECIMAL(12,2),
  salary_range_max DECIMAL(12,2),
  currency TEXT DEFAULT 'IDR',
  employment_type TEXT DEFAULT 'full_time',
  location_type TEXT DEFAULT 'office',
  ai_generated BOOLEAN DEFAULT TRUE,
  ai_prompt_used TEXT,
  tone TEXT DEFAULT 'professional',
  language TEXT DEFAULT 'id',
  generated_by UUID NOT NULL,
  reviewed_by UUID,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create XLSMART Skill Assessments table
CREATE TABLE public.xlsmart_skill_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  job_description_id UUID NOT NULL REFERENCES public.xlsmart_job_descriptions(id) ON DELETE CASCADE,
  overall_match_percentage DECIMAL(5,2) DEFAULT 0.0,
  skill_gaps JSONB DEFAULT '[]'::jsonb,
  next_role_recommendations JSONB DEFAULT '[]'::jsonb,
  level_fit_score DECIMAL(5,2) DEFAULT 0.0,
  rotation_risk_score DECIMAL(5,2) DEFAULT 0.0,
  churn_risk_score DECIMAL(5,2) DEFAULT 0.0,
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assessed_by UUID NOT NULL,
  ai_analysis TEXT,
  recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create XLSMART Development Plans table
CREATE TABLE public.xlsmart_development_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  skill_assessment_id UUID REFERENCES public.xlsmart_skill_assessments(id) ON DELETE SET NULL,
  target_role TEXT,
  current_skill_level DECIMAL(3,2) DEFAULT 0.0,
  target_skill_level DECIMAL(3,2) DEFAULT 0.0,
  development_areas JSONB DEFAULT '[]'::jsonb,
  recommended_courses JSONB DEFAULT '[]'::jsonb,
  recommended_certifications JSONB DEFAULT '[]'::jsonb,
  recommended_projects JSONB DEFAULT '[]'::jsonb,
  timeline_months INTEGER DEFAULT 12,
  progress_percentage DECIMAL(5,2) DEFAULT 0.0,
  plan_status TEXT NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active', 'completed', 'paused', 'cancelled')),
  created_by UUID NOT NULL,
  assigned_to UUID NOT NULL,
  reviewed_by UUID,
  last_review_date TIMESTAMP WITH TIME ZONE,
  next_review_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.xlsmart_role_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xlsmart_role_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xlsmart_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xlsmart_job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xlsmart_skill_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xlsmart_development_plans ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for HR managers and super admins
CREATE POLICY "HR managers can manage role catalogs" 
ON public.xlsmart_role_catalogs 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

CREATE POLICY "HR managers can manage role mappings" 
ON public.xlsmart_role_mappings 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

CREATE POLICY "HR managers can manage employees" 
ON public.xlsmart_employees 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

CREATE POLICY "HR managers can manage job descriptions" 
ON public.xlsmart_job_descriptions 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

CREATE POLICY "HR managers can manage skill assessments" 
ON public.xlsmart_skill_assessments 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

CREATE POLICY "HR managers can manage development plans" 
ON public.xlsmart_development_plans 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Create triggers for updating timestamps
CREATE TRIGGER update_xlsmart_role_catalogs_updated_at
  BEFORE UPDATE ON public.xlsmart_role_catalogs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_xlsmart_role_mappings_updated_at
  BEFORE UPDATE ON public.xlsmart_role_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_xlsmart_employees_updated_at
  BEFORE UPDATE ON public.xlsmart_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_xlsmart_job_descriptions_updated_at
  BEFORE UPDATE ON public.xlsmart_job_descriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_xlsmart_skill_assessments_updated_at
  BEFORE UPDATE ON public.xlsmart_skill_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_xlsmart_development_plans_updated_at
  BEFORE UPDATE ON public.xlsmart_development_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();