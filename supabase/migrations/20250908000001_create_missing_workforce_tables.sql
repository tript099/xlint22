-- Create missing tables for workforce analytics

-- Employee Skills table
CREATE TABLE IF NOT EXISTS public.employee_skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    proficiency_level INTEGER CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
    years_of_experience DECIMAL(3,1),
    certification_level TEXT,
    last_assessed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Employee Trainings table
CREATE TABLE IF NOT EXISTS public.employee_trainings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
    training_name TEXT NOT NULL,
    training_type TEXT,
    provider TEXT,
    start_date DATE,
    end_date DATE,
    completion_date DATE,
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
    duration_hours DECIMAL(5,2),
    cost DECIMAL(10,2),
    certification_earned BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Skill Gap Analysis table
CREATE TABLE IF NOT EXISTS public.skill_gap_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.xlsmart_standard_roles(id),
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    overall_match_percentage DECIMAL(5,2),
    critical_gaps TEXT[],
    recommended_skills TEXT[],
    training_recommendations TEXT[],
    readiness_score DECIMAL(5,2),
    gap_severity TEXT CHECK (gap_severity IN ('low', 'medium', 'high', 'critical')),
    action_items JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Employee Moves table (for tracking internal mobility)
CREATE TABLE IF NOT EXISTS public.employee_moves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
    from_department TEXT,
    to_department TEXT,
    from_position TEXT,
    to_position TEXT,
    move_type TEXT CHECK (move_type IN ('promotion', 'lateral', 'demotion', 'transfer')),
    move_date DATE NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.xlsmart_employees(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id ON public.employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill_name ON public.employee_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_employee_trainings_employee_id ON public.employee_trainings(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_trainings_status ON public.employee_trainings(status);
CREATE INDEX IF NOT EXISTS idx_skill_gap_analysis_employee_id ON public.skill_gap_analysis(employee_id);
CREATE INDEX IF NOT EXISTS idx_skill_gap_analysis_overall_match ON public.skill_gap_analysis(overall_match_percentage);
CREATE INDEX IF NOT EXISTS idx_employee_moves_employee_id ON public.employee_moves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_moves_date ON public.employee_moves(move_date);

-- Enable RLS (Row Level Security)
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_gap_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_moves ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow authenticated users to read all data)
CREATE POLICY "Allow authenticated users to view employee skills" ON public.employee_skills
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view employee trainings" ON public.employee_trainings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view skill gap analysis" ON public.skill_gap_analysis
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view employee moves" ON public.employee_moves
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update/delete their own data
CREATE POLICY "Allow authenticated users to insert employee skills" ON public.employee_skills
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update employee skills" ON public.employee_skills
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete employee skills" ON public.employee_skills
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert employee trainings" ON public.employee_trainings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update employee trainings" ON public.employee_trainings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete employee trainings" ON public.employee_trainings
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert skill gap analysis" ON public.skill_gap_analysis
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update skill gap analysis" ON public.skill_gap_analysis
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete skill gap analysis" ON public.skill_gap_analysis
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert employee moves" ON public.employee_moves
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update employee moves" ON public.employee_moves
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete employee moves" ON public.employee_moves
    FOR DELETE USING (auth.role() = 'authenticated');
