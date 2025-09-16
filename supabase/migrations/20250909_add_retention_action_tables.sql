-- Migration: Add retention action planning tables
-- File: 20250909_add_retention_action_tables.sql

-- Store retention action templates
CREATE TABLE IF NOT EXISTS retention_action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL, -- 'career_development', 'compensation', 'engagement', 'training', 'immediate'
  action_name VARCHAR(200) NOT NULL,
  description TEXT,
  success_rate DECIMAL(5,2) DEFAULT 65.0, -- Historical success rate percentage
  average_timeline_days INTEGER DEFAULT 30,
  applicable_risk_levels TEXT[] DEFAULT ARRAY['high', 'medium', 'low'], -- Risk levels this applies to
  applicable_roles TEXT[] DEFAULT ARRAY['all'], -- Specific roles or 'all'
  cost_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high'
  priority_score INTEGER DEFAULT 50, -- 1-100 priority ranking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store individual employee retention plans
CREATE TABLE IF NOT EXISTS employee_retention_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES xlsmart_employees(id),
  flight_risk_score INTEGER NOT NULL,
  risk_factors TEXT[] DEFAULT '{}', -- Array of identified risk factors
  recommended_actions JSONB DEFAULT '[]'::jsonb, -- Array of action objects
  assigned_manager_id UUID,
  plan_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  success_probability DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  target_completion_date DATE,
  actual_completion_date DATE,
  notes TEXT
);

-- Track individual action executions and results
CREATE TABLE IF NOT EXISTS retention_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_plan_id UUID REFERENCES employee_retention_plans(id),
  action_type VARCHAR(50) NOT NULL,
  action_description TEXT NOT NULL,
  executed_by UUID,
  execution_date TIMESTAMP DEFAULT NOW(),
  completion_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  effectiveness_rating INTEGER, -- 1-5 scale (filled after completion)
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default retention action templates
INSERT INTO retention_action_templates (action_type, action_name, description, success_rate, average_timeline_days, applicable_risk_levels, priority_score) VALUES
-- Immediate Actions (1-7 days)
('immediate', 'Schedule 1-on-1 Meeting', 'Immediate manager discussion to understand concerns and provide support', 78.0, 3, ARRAY['high', 'medium'], 90),
('immediate', 'Recognition & Appreciation', 'Public recognition for recent achievements and contributions', 65.0, 1, ARRAY['high', 'medium', 'low'], 70),
('immediate', 'Workload Assessment', 'Review current workload and redistribute if necessary', 72.0, 5, ARRAY['high', 'medium'], 80),

-- Career Development (1-3 months)
('career_development', 'Promotion Pathway Discussion', 'Clear conversation about career advancement opportunities and timeline', 82.0, 30, ARRAY['high', 'medium'], 95),
('career_development', 'Internal Mobility Opportunities', 'Explore lateral moves and cross-functional opportunities', 75.0, 45, ARRAY['high', 'medium'], 85),
('career_development', 'Mentorship Program Enrollment', 'Pair with senior leader for career guidance and development', 68.0, 14, ARRAY['high', 'medium', 'low'], 75),
('career_development', 'Leadership Training Program', 'Enroll in leadership development courses and workshops', 71.0, 60, ARRAY['high', 'medium'], 80),

-- Compensation & Benefits (1-6 months)
('compensation', 'Market Salary Analysis', 'Conduct thorough market analysis and salary benchmarking', 85.0, 30, ARRAY['high'], 100),
('compensation', 'Performance Bonus Review', 'Evaluate for immediate performance-based bonus or incentive', 76.0, 14, ARRAY['high', 'medium'], 90),
('compensation', 'Benefits Package Review', 'Review and optimize benefits package including health, leave, perks', 58.0, 45, ARRAY['high', 'medium', 'low'], 65),
('compensation', 'Retention Bonus Consideration', 'Evaluate for retention bonus to secure commitment', 88.0, 21, ARRAY['high'], 95),

-- Training & Development (1-4 months)
('training', 'Skills Development Program', 'Identify skill gaps and provide targeted training opportunities', 69.0, 60, ARRAY['high', 'medium', 'low'], 70),
('training', 'Conference & Certification Sponsorship', 'Sponsor attendance at industry conferences and professional certifications', 73.0, 90, ARRAY['high', 'medium'], 75),
('training', 'Cross-Department Exposure', 'Provide opportunities to work with other departments and gain new perspectives', 66.0, 45, ARRAY['medium', 'low'], 60),

-- Engagement & Culture (Ongoing)
('engagement', 'Flexible Work Arrangements', 'Discuss and implement flexible working hours or remote work options', 74.0, 14, ARRAY['high', 'medium', 'low'], 80),
('engagement', 'Team Assignment Optimization', 'Review current team dynamics and consider team changes if beneficial', 67.0, 30, ARRAY['high', 'medium'], 70),
('engagement', 'Special Project Assignment', 'Assign to high-visibility or innovative projects to increase engagement', 71.0, 21, ARRAY['high', 'medium'], 85),
('engagement', 'Work-Life Balance Review', 'Assess and address work-life balance concerns and stress factors', 63.0, 14, ARRAY['high', 'medium', 'low'], 75);

-- Enable RLS (Row Level Security)
ALTER TABLE retention_action_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_retention_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_action_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON retention_action_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON employee_retention_plans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON retention_action_executions FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_retention_plans_employee_id ON employee_retention_plans(employee_id);
CREATE INDEX idx_retention_plans_status ON employee_retention_plans(plan_status);
CREATE INDEX idx_retention_plans_risk_score ON employee_retention_plans(flight_risk_score);
CREATE INDEX idx_action_executions_plan_id ON retention_action_executions(retention_plan_id);
CREATE INDEX idx_action_executions_status ON retention_action_executions(completion_status);
CREATE INDEX idx_action_templates_type ON retention_action_templates(action_type);
CREATE INDEX idx_action_templates_risk_levels ON retention_action_templates USING GIN(applicable_risk_levels);
