-- Create comprehensive training system tables
-- Training Programs catalog
CREATE TABLE public.training_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'Leadership', 'Technical', 'Soft Skills', 'Compliance', etc.
  type TEXT NOT NULL, -- 'online', 'classroom', 'hybrid', 'certification'
  provider TEXT, -- Internal, external provider name
  duration_hours INTEGER NOT NULL DEFAULT 0,
  duration_weeks INTEGER NOT NULL DEFAULT 0,
  difficulty_level TEXT CHECK (difficulty_level IN ('Beginner', 'Intermediate', 'Advanced')) DEFAULT 'Beginner',
  prerequisites TEXT[], -- Array of prerequisite skills/courses
  learning_objectives TEXT[],
  target_audience TEXT[], -- Array of roles/departments
  max_participants INTEGER DEFAULT 50,
  cost_per_participant DECIMAL(12,2) DEFAULT 0.0,
  certification_provided BOOLEAN DEFAULT false,
  certification_name TEXT,
  certification_validity_months INTEGER,
  tags TEXT[], -- Skills, keywords for search
  content_url TEXT,
  instructor_name TEXT,
  instructor_email TEXT,
  schedule_type TEXT CHECK (schedule_type IN ('self_paced', 'scheduled', 'recurring')) DEFAULT 'self_paced',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  enrollment_deadline TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('draft', 'active', 'inactive', 'completed', 'cancelled')) DEFAULT 'draft',
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Employee Training Enrollments
CREATE TABLE public.employee_training_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  training_program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  enrollment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  enrollment_type TEXT CHECK (enrollment_type IN ('self_enrolled', 'manager_assigned', 'hr_assigned', 'mandatory', 'ai_recommended')) DEFAULT 'self_enrolled',
  recommended_by UUID REFERENCES public.xlsmart_employees(id),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  target_completion_date TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('enrolled', 'in_progress', 'completed', 'cancelled', 'failed', 'expired')) DEFAULT 'enrolled',
  progress_percentage DECIMAL(5,2) DEFAULT 0.0,
  time_spent_hours DECIMAL(8,2) DEFAULT 0.0,
  last_activity_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(employee_id, training_program_id)
);

-- Training Completions and Results
CREATE TABLE public.training_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.employee_training_enrollments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  training_program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  completion_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completion_status TEXT CHECK (completion_status IN ('passed', 'failed', 'partial', 'expired')) NOT NULL DEFAULT 'passed',
  final_score DECIMAL(5,2), -- Percentage score
  passing_score DECIMAL(5,2) DEFAULT 70.0,
  time_to_complete_hours DECIMAL(8,2),
  assessment_scores JSONB, -- Detailed assessment breakdown
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comments TEXT,
  skills_acquired TEXT[], -- Array of skills gained
  competency_improvements JSONB, -- Before/after skill levels
  certificate_issued BOOLEAN DEFAULT false,
  certificate_number TEXT,
  certificate_expiry_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Training Analytics and Metrics
CREATE TABLE public.training_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_program_id UUID REFERENCES public.training_programs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  department TEXT,
  analysis_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  analysis_date DATE NOT NULL,
  metric_type TEXT NOT NULL, -- 'enrollment', 'completion', 'effectiveness', 'roi', 'satisfaction'
  metric_value DECIMAL(12,2) NOT NULL,
  metric_details JSONB,
  comparison_period_value DECIMAL(12,2),
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  insights TEXT[],
  recommendations TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_programs
CREATE POLICY "training_programs_select_policy" ON public.training_programs
  FOR SELECT USING (true);

CREATE POLICY "training_programs_insert_policy" ON public.training_programs
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = created_by);

CREATE POLICY "training_programs_update_policy" ON public.training_programs
  FOR UPDATE USING (auth.role() = 'service_role' OR auth.uid() = created_by OR auth.uid() = updated_by);

-- RLS Policies for employee_training_enrollments
CREATE POLICY "enrollments_select_policy" ON public.employee_training_enrollments
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    ) OR
    employee_id = auth.uid()
  );

CREATE POLICY "enrollments_insert_policy" ON public.employee_training_enrollments
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    ) OR
    employee_id = auth.uid()
  );

-- RLS Policies for training_completions
CREATE POLICY "completions_select_policy" ON public.training_completions
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    ) OR
    employee_id = auth.uid()
  );

CREATE POLICY "completions_insert_policy" ON public.training_completions
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    )
  );

-- RLS Policies for training_analytics
CREATE POLICY "analytics_select_policy" ON public.training_analytics
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    )
  );

CREATE POLICY "analytics_insert_policy" ON public.training_analytics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_training_programs_category ON public.training_programs(category);
CREATE INDEX idx_training_programs_status ON public.training_programs(status);
CREATE INDEX idx_training_programs_tags ON public.training_programs USING GIN(tags);

CREATE INDEX idx_enrollments_employee ON public.employee_training_enrollments(employee_id);
CREATE INDEX idx_enrollments_program ON public.employee_training_enrollments(training_program_id);
CREATE INDEX idx_enrollments_status ON public.employee_training_enrollments(status);
CREATE INDEX idx_enrollments_date ON public.employee_training_enrollments(enrollment_date);

CREATE INDEX idx_completions_employee ON public.training_completions(employee_id);
CREATE INDEX idx_completions_program ON public.training_completions(training_program_id);
CREATE INDEX idx_completions_date ON public.training_completions(completion_date);

CREATE INDEX idx_analytics_program_period ON public.training_analytics(training_program_id, analysis_period, analysis_date);
CREATE INDEX idx_analytics_employee_period ON public.training_analytics(employee_id, analysis_period, analysis_date);
CREATE INDEX idx_analytics_metric_date ON public.training_analytics(metric_type, analysis_date);

-- Add some sample training programs
INSERT INTO public.training_programs (
  name, description, category, type, duration_hours, duration_weeks, 
  difficulty_level, target_audience, learning_objectives, tags, 
  status, created_by
) VALUES 
(
  'Leadership Fundamentals',
  'Essential leadership skills for managers and team leads',
  'Leadership',
  'hybrid',
  40,
  8,
  'Beginner',
  ARRAY['Manager', 'Team Lead', 'Supervisor'],
  ARRAY['Team Management', 'Communication', 'Decision Making', 'Conflict Resolution'],
  ARRAY['leadership', 'management', 'communication', 'team building'],
  'active',
  '00000000-0000-0000-0000-000000000000'
),
(
  'Advanced Technical Skills Development',
  'Comprehensive technical training for engineering professionals',
  'Technical',
  'online',
  60,
  12,
  'Advanced',
  ARRAY['Software Engineer', 'DevOps Engineer', 'Technical Lead'],
  ARRAY['Advanced Programming', 'System Architecture', 'Performance Optimization'],
  ARRAY['programming', 'architecture', 'performance', 'development'],
  'active',
  '00000000-0000-0000-0000-000000000000'
),
(
  'Communication Excellence',
  'Professional communication skills for all employees',
  'Soft Skills',
  'online',
  20,
  6,
  'Beginner',
  ARRAY['All Employees'],
  ARRAY['Verbal Communication', 'Written Communication', 'Presentation Skills'],
  ARRAY['communication', 'presentation', 'writing', 'speaking'],
  'active',
  '00000000-0000-0000-0000-000000000000'
),
(
  'Data Analytics & Business Intelligence',
  'Learn to analyze data and create business insights',
  'Technical',
  'hybrid',
  35,
  10,
  'Intermediate',
  ARRAY['Business Analyst', 'Data Analyst', 'Manager'],
  ARRAY['Data Analysis', 'Business Intelligence', 'Reporting', 'Dashboards'],
  ARRAY['data', 'analytics', 'business intelligence', 'reporting'],
  'active',
  '00000000-0000-0000-0000-000000000000'
),
(
  'Project Management Professional (PMP)',
  'Comprehensive project management certification preparation',
  'Leadership',
  'classroom',
  80,
  16,
  'Advanced',
  ARRAY['Project Manager', 'Team Lead', 'Senior Engineer'],
  ARRAY['Project Planning', 'Risk Management', 'Stakeholder Management', 'Quality Control'],
  ARRAY['project management', 'pmp', 'certification', 'planning'],
  'active',
  '00000000-0000-0000-0000-000000000000'
);
