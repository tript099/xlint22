-- Create XLSMART Standard Roles Catalog (Master Taxonomy)
CREATE TABLE public.xlsmart_standard_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_title TEXT NOT NULL UNIQUE,
  job_family TEXT NOT NULL, -- e.g., Technology, Marketing, Sales, HR, Finance, Operations
  role_level TEXT NOT NULL, -- e.g., L1-L8, M1-M5, VP, SVP, C-Level
  role_category TEXT NOT NULL, -- e.g., Individual Contributor, Manager, Director, Executive
  department TEXT NOT NULL,
  standard_description TEXT,
  core_responsibilities JSONB DEFAULT '[]'::jsonb,
  required_skills JSONB DEFAULT '[]'::jsonb,
  experience_range_min INTEGER DEFAULT 0,
  experience_range_max INTEGER DEFAULT 50,
  education_requirements JSONB DEFAULT '[]'::jsonb,
  salary_grade TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  industry_alignment TEXT DEFAULT 'Telecommunications',
  keywords JSONB DEFAULT '[]'::jsonb, -- For AI matching
  created_by UUID NOT NULL,
  approved_by UUID,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster searching and matching
CREATE INDEX idx_xlsmart_standard_roles_keywords ON public.xlsmart_standard_roles USING GIN(keywords);
CREATE INDEX idx_xlsmart_standard_roles_job_family ON public.xlsmart_standard_roles(job_family);
CREATE INDEX idx_xlsmart_standard_roles_level ON public.xlsmart_standard_roles(role_level);

-- Enable RLS
ALTER TABLE public.xlsmart_standard_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for standard roles
CREATE POLICY "HR managers can manage standard roles" 
ON public.xlsmart_standard_roles 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Add trigger for updating timestamps
CREATE TRIGGER update_xlsmart_standard_roles_updated_at
  BEFORE UPDATE ON public.xlsmart_standard_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create skills_master table for centralized skills taxonomy
CREATE TABLE public.skills_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on skills_master
ALTER TABLE public.skills_master ENABLE ROW LEVEL SECURITY;

-- Create policy for skills_master
CREATE POLICY "HR managers can manage skills" 
ON public.skills_master 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Indexes for search and categorization
CREATE INDEX idx_skills_master_category ON skills_master(category);
CREATE INDEX idx_skills_master_name ON skills_master(name);

-- Update role mappings table to reference standard roles
ALTER TABLE public.xlsmart_role_mappings 
ADD COLUMN standard_role_id UUID REFERENCES public.xlsmart_standard_roles(id);

-- Insert comprehensive XLSMART standard roles catalog
INSERT INTO public.xlsmart_standard_roles (
  role_title, job_family, role_level, role_category, department, 
  standard_description, core_responsibilities, required_skills, 
  experience_range_min, experience_range_max, education_requirements, 
  salary_grade, keywords, created_by
) VALUES 
-- Technology Job Family
('Software Engineer I', 'Technology', 'L3', 'Individual Contributor', 'Engineering',
 'Entry-level software engineer responsible for developing and maintaining software applications',
 '["Write clean, maintainable code", "Participate in code reviews", "Debug and fix software issues", "Collaborate with team members"]',
 '["Programming languages", "Version control", "Software development fundamentals", "Problem solving"]',
 0, 2, '["Bachelor in Computer Science or related field"]', 'T3',
 '["software", "engineer", "developer", "programming", "coding", "junior"]',
 '00000000-0000-0000-0000-000000000000'),

('Software Engineer II', 'Technology', 'L4', 'Individual Contributor', 'Engineering',
 'Mid-level software engineer with proven experience in software development',
 '["Design and implement software solutions", "Mentor junior developers", "Lead technical discussions", "Optimize application performance"]',
 '["Advanced programming", "System design", "Database management", "API development"]',
 2, 5, '["Bachelor in Computer Science or related field"]', 'T4',
 '["software", "engineer", "developer", "programming", "senior", "mid-level"]',
 '00000000-0000-0000-0000-000000000000'),

('Senior Software Engineer', 'Technology', 'L5', 'Individual Contributor', 'Engineering',
 'Senior software engineer responsible for complex technical solutions and team leadership',
 '["Architect complex software systems", "Lead technical initiatives", "Mentor development team", "Drive technical standards"]',
 '["Expert programming", "System architecture", "Team leadership", "Technical strategy"]',
 5, 8, '["Bachelor in Computer Science or related field"]', 'T5',
 '["senior", "software", "engineer", "architect", "lead", "technical"]',
 '00000000-0000-0000-0000-000000000000'),

('Engineering Manager', 'Technology', 'M2', 'Manager', 'Engineering',
 'Engineering manager responsible for leading software development teams',
 '["Manage engineering teams", "Drive technical roadmap", "Performance management", "Cross-functional collaboration"]',
 '["Technical leadership", "People management", "Project management", "Strategic thinking"]',
 6, 12, '["Bachelor in Computer Science/Engineering or MBA"]', 'M2',
 '["engineering", "manager", "technical", "lead", "team", "management"]',
 '00000000-0000-0000-0000-000000000000'),

-- Marketing Job Family  
('Marketing Specialist', 'Marketing', 'L3', 'Individual Contributor', 'Marketing',
 'Marketing specialist responsible for executing marketing campaigns and initiatives',
 '["Execute marketing campaigns", "Content creation", "Market research", "Performance analysis"]',
 '["Digital marketing", "Content creation", "Analytics", "Campaign management"]',
 1, 3, '["Bachelor in Marketing, Communications or related field"]', 'M3',
 '["marketing", "specialist", "campaign", "digital", "content", "social"]',
 '00000000-0000-0000-0000-000000000000'),

('Senior Marketing Specialist', 'Marketing', 'L4', 'Individual Contributor', 'Marketing',
 'Senior marketing specialist with expertise in multi-channel marketing strategies',
 '["Lead marketing campaigns", "Strategy development", "Team coordination", "ROI optimization"]',
 '["Advanced digital marketing", "Strategy planning", "Team leadership", "Data analysis"]',
 3, 6, '["Bachelor in Marketing, Communications or related field"]', 'M4',
 '["senior", "marketing", "specialist", "strategy", "campaign", "digital"]',
 '00000000-0000-0000-0000-000000000000'),

('Marketing Manager', 'Marketing', 'M1', 'Manager', 'Marketing',
 'Marketing manager responsible for developing and executing marketing strategies',
 '["Develop marketing strategy", "Manage marketing team", "Budget management", "Brand positioning"]',
 '["Marketing strategy", "Team management", "Budget planning", "Brand management"]',
 5, 8, '["Bachelor in Marketing/Business or MBA"]', 'M5',
 '["marketing", "manager", "strategy", "brand", "team", "management"]',
 '00000000-0000-0000-0000-000000000000'),

-- Sales Job Family
('Sales Representative', 'Sales', 'L3', 'Individual Contributor', 'Sales',
 'Sales representative responsible for acquiring new customers and managing accounts',
 '["Prospect new customers", "Manage sales pipeline", "Customer relationship management", "Achieve sales targets"]',
 '["Sales techniques", "Customer service", "CRM systems", "Communication skills"]',
 1, 3, '["Bachelor degree preferred"]', 'S3',
 '["sales", "representative", "account", "customer", "business", "development"]',
 '00000000-0000-0000-0000-000000000000'),

('Senior Sales Representative', 'Sales', 'L4', 'Individual Contributor', 'Sales',
 'Senior sales representative with proven track record in enterprise sales',
 '["Manage key accounts", "Develop sales strategies", "Mentor junior staff", "Drive revenue growth"]',
 '["Advanced sales techniques", "Account management", "Negotiation", "Leadership"]',
 3, 6, '["Bachelor degree preferred"]', 'S4',
 '["senior", "sales", "representative", "account", "enterprise", "key"]',
 '00000000-0000-0000-0000-000000000000'),

('Sales Manager', 'Sales', 'M1', 'Manager', 'Sales',
 'Sales manager responsible for leading sales teams and driving revenue targets',
 '["Lead sales team", "Develop sales strategy", "Performance management", "Territory planning"]',
 '["Sales leadership", "Team management", "Strategic planning", "Performance optimization"]',
 5, 10, '["Bachelor in Business/Sales or MBA"]', 'M4',
 '["sales", "manager", "team", "leadership", "territory", "revenue"]',
 '00000000-0000-0000-0000-000000000000'),

-- HR Job Family
('HR Specialist', 'Human Resources', 'L3', 'Individual Contributor', 'Human Resources',
 'HR specialist responsible for various HR functions and employee support',
 '["Employee onboarding", "HR policy implementation", "Employee relations", "Compliance management"]',
 '["HR processes", "Employment law", "Communication", "Problem solving"]',
 1, 4, '["Bachelor in HR, Psychology or related field"]', 'H3',
 '["hr", "human", "resources", "specialist", "employee", "relations"]',
 '00000000-0000-0000-0000-000000000000'),

('HR Business Partner', 'Human Resources', 'L4', 'Individual Contributor', 'Human Resources',
 'HR business partner providing strategic HR support to business units',
 '["Strategic HR consulting", "Talent management", "Performance coaching", "Change management"]',
 '["Strategic HR", "Business acumen", "Consulting skills", "Change management"]',
 4, 7, '["Bachelor in HR/Business or relevant certification"]', 'H4',
 '["hr", "business", "partner", "strategic", "talent", "consulting"]',
 '00000000-0000-0000-0000-000000000000'),

('HR Manager', 'Human Resources', 'M1', 'Manager', 'Human Resources',
 'HR manager responsible for leading HR functions and team management',
 '["Lead HR team", "HR strategy development", "Policy management", "Stakeholder management"]',
 '["HR leadership", "Strategic planning", "Team management", "Policy development"]',
 6, 10, '["Bachelor in HR/Business or MBA"]', 'M3',
 '["hr", "manager", "human", "resources", "team", "leadership", "strategy"]',
 '00000000-0000-0000-0000-000000000000'),

-- Finance Job Family
('Financial Analyst', 'Finance', 'L3', 'Individual Contributor', 'Finance',
 'Financial analyst responsible for financial analysis and reporting',
 '["Financial modeling", "Budget analysis", "Financial reporting", "Variance analysis"]',
 '["Financial analysis", "Excel proficiency", "Accounting principles", "Data analysis"]',
 1, 3, '["Bachelor in Finance, Accounting or related field"]', 'F3',
 '["financial", "analyst", "finance", "budget", "modeling", "reporting"]',
 '00000000-0000-0000-0000-000000000000'),

('Senior Financial Analyst', 'Finance', 'L4', 'Individual Contributor', 'Finance',
 'Senior financial analyst with advanced financial modeling and analysis capabilities',
 '["Complex financial modeling", "Strategic analysis", "Team guidance", "Process improvement"]',
 '["Advanced financial analysis", "Strategic thinking", "Leadership", "Process optimization"]',
 3, 6, '["Bachelor in Finance/Accounting, CFA preferred"]', 'F4',
 '["senior", "financial", "analyst", "strategic", "modeling", "advanced"]',
 '00000000-0000-0000-0000-000000000000'),

('Finance Manager', 'Finance', 'M1', 'Manager', 'Finance',
 'Finance manager responsible for financial planning, analysis and team leadership',
 '["Financial planning", "Team management", "Budget oversight", "Financial strategy"]',
 '["Financial management", "Team leadership", "Strategic planning", "Risk management"]',
 5, 8, '["Bachelor in Finance/Accounting, MBA or CPA preferred"]', 'M3',
 '["finance", "manager", "financial", "planning", "team", "budget"]',
 '00000000-0000-0000-0000-000000000000'),

-- Operations Job Family
('Operations Specialist', 'Operations', 'L3', 'Individual Contributor', 'Operations',
 'Operations specialist responsible for optimizing business processes and operations',
 '["Process optimization", "Operational analysis", "Project coordination", "Quality assurance"]',
 '["Process improvement", "Project management", "Analytical thinking", "Quality management"]',
 1, 4, '["Bachelor degree in relevant field"]', 'O3',
 '["operations", "specialist", "process", "optimization", "coordination"]',
 '00000000-0000-0000-0000-000000000000'),

('Operations Manager', 'Operations', 'M1', 'Manager', 'Operations',
 'Operations manager responsible for managing operational functions and teams',
 '["Operations management", "Team leadership", "Process design", "Performance optimization"]',
 '["Operations management", "Leadership", "Strategic thinking", "Process design"]',
 4, 8, '["Bachelor in Operations/Business or MBA"]', 'M3',
 '["operations", "manager", "operational", "team", "leadership", "process"]',
 '00000000-0000-0000-0000-000000000000');