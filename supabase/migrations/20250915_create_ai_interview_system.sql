-- Migration: Create AI Interview System Tables
-- Created: 2025-09-15
-- Description: Tables for storing AI interview sessions, results, and analytics

-- Table: interview_sessions
-- Stores individual interview sessions between employees and AI system
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES xlsmart_employees(id) ON DELETE CASCADE,
    job_description_id UUID NOT NULL REFERENCES xlsmart_job_descriptions(id) ON DELETE CASCADE,
    
    -- Session metadata
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    -- Interview content
    job_requirements TEXT, -- Snapshot of JD requirements at interview time
    interview_notes TEXT,
    interview_type VARCHAR(50) DEFAULT 'role_assessment' 
        CHECK (interview_type IN ('role_assessment', 'promotion', 'performance_review', 'skill_evaluation')),
    
    -- AI Analysis Results
    transcript JSONB, -- Full interview transcript
    ai_analysis JSONB, -- AI analysis results
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    skill_scores JSONB, -- Individual skill assessments
    recommendations TEXT[],
    strengths TEXT[],
    areas_for_improvement TEXT[],
    
    -- System fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_session_timing CHECK (
        (started_at IS NULL OR started_at >= scheduled_at) AND
        (completed_at IS NULL OR (started_at IS NOT NULL AND completed_at >= started_at))
    )
);

-- Table: interview_questions
-- Stores the questions asked during interviews for analytics
CREATE TABLE IF NOT EXISTS interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_category VARCHAR(50), -- 'technical', 'behavioral', 'role_specific', etc.
    asked_at TIMESTAMPTZ DEFAULT NOW(),
    ai_response TEXT,
    employee_response TEXT,
    response_score INTEGER CHECK (response_score >= 0 AND response_score <= 100),
    response_analysis JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: interview_analytics
-- Aggregated analytics for reporting and insights
CREATE TABLE IF NOT EXISTS interview_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES xlsmart_employees(id) ON DELETE CASCADE,
    department VARCHAR(100),
    role_category VARCHAR(100),
    
    -- Time period for analytics
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Aggregated metrics
    total_interviews INTEGER DEFAULT 0,
    completed_interviews INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    improvement_trend VARCHAR(20), -- 'improving', 'stable', 'declining'
    
    -- Skill progression
    skill_progression JSONB, -- Track skill development over time
    career_readiness_score INTEGER CHECK (career_readiness_score >= 0 AND career_readiness_score <= 100),
    promotion_readiness BOOLEAN DEFAULT FALSE,
    
    -- Recommendations
    development_recommendations TEXT[],
    next_interview_suggested_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate analytics for same period
    UNIQUE(employee_id, period_start, period_end)
);

-- Table: interview_templates
-- Predefined interview templates for different roles/scenarios
CREATE TABLE IF NOT EXISTS interview_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    role_category VARCHAR(100), -- Links to standardized roles
    interview_type VARCHAR(50) NOT NULL,
    
    -- Template configuration
    question_categories JSONB, -- Categories and weightings
    duration_minutes INTEGER DEFAULT 30,
    difficulty_level VARCHAR(20) DEFAULT 'intermediate'
        CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    
    -- AI Configuration
    ai_personality JSONB, -- How the AI should behave
    evaluation_criteria JSONB, -- What to focus on during evaluation
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_employee_id ON interview_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_scheduled_at ON interview_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_job_description_id ON interview_sessions(job_description_id);

CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id ON interview_questions(interview_session_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_category ON interview_questions(question_category);

CREATE INDEX IF NOT EXISTS idx_interview_analytics_employee_id ON interview_analytics(employee_id);
CREATE INDEX IF NOT EXISTS idx_interview_analytics_period ON interview_analytics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_interview_templates_role_category ON interview_templates(role_category);
CREATE INDEX IF NOT EXISTS idx_interview_templates_active ON interview_templates(is_active);

-- Create GIN indexes for JSONB columns for better query performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_transcript_gin ON interview_sessions USING GIN(transcript);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_ai_analysis_gin ON interview_sessions USING GIN(ai_analysis);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_skill_scores_gin ON interview_sessions USING GIN(skill_scores);

-- Enable RLS (Row Level Security)
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - can be refined based on your auth requirements)
CREATE POLICY "Users can access all interview data" ON interview_sessions FOR ALL USING (true);
CREATE POLICY "Users can access all interview questions" ON interview_questions FOR ALL USING (true);
CREATE POLICY "Users can access all interview analytics" ON interview_analytics FOR ALL USING (true);
CREATE POLICY "Users can access all interview templates" ON interview_templates FOR ALL USING (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at fields
CREATE TRIGGER update_interview_sessions_updated_at 
    BEFORE UPDATE ON interview_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_analytics_updated_at 
    BEFORE UPDATE ON interview_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_templates_updated_at 
    BEFORE UPDATE ON interview_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default interview templates
INSERT INTO interview_templates (name, description, role_category, interview_type, question_categories, duration_minutes, difficulty_level, ai_personality, evaluation_criteria, is_active) VALUES
(
    'Software Engineer Assessment',
    'Technical interview for software engineering roles',
    'Technology',
    'role_assessment',
    '{"technical": 60, "problem_solving": 25, "communication": 15}',
    45,
    'intermediate',
    '{"tone": "professional", "style": "technical", "focus": "problem_solving"}',
    '{"code_quality": 30, "system_design": 25, "algorithms": 25, "communication": 20}',
    true
),
(
    'Management Readiness Assessment',
    'Leadership and management capability evaluation',
    'Management',
    'promotion',
    '{"leadership": 40, "strategic_thinking": 30, "team_management": 20, "communication": 10}',
    60,
    'advanced',
    '{"tone": "authoritative", "style": "business", "focus": "leadership"}',
    '{"leadership_potential": 35, "decision_making": 25, "team_building": 25, "strategic_vision": 15}',
    true
),
(
    'Customer Service Excellence',
    'Customer service and support role assessment',
    'Customer Service',
    'role_assessment',
    '{"customer_focus": 40, "communication": 30, "problem_solving": 20, "empathy": 10}',
    30,
    'beginner',
    '{"tone": "friendly", "style": "conversational", "focus": "customer_service"}',
    '{"customer_satisfaction": 40, "communication_skills": 30, "conflict_resolution": 20, "product_knowledge": 10}',
    true
);

-- Add some comments for documentation
COMMENT ON TABLE interview_sessions IS 'Core table storing AI interview sessions between employees and the system';
COMMENT ON TABLE interview_questions IS 'Individual questions and responses from interview sessions';
COMMENT ON TABLE interview_analytics IS 'Aggregated analytics and insights from interview data';
COMMENT ON TABLE interview_templates IS 'Reusable interview templates for different roles and scenarios';

COMMENT ON COLUMN interview_sessions.transcript IS 'Full interview transcript in JSONB format with timestamps';
COMMENT ON COLUMN interview_sessions.ai_analysis IS 'AI analysis results including detailed breakdowns and insights';
COMMENT ON COLUMN interview_sessions.skill_scores IS 'Individual skill assessments in JSONB format';