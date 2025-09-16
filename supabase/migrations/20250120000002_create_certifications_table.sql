-- Create employee certifications table for tracking professional certifications
CREATE TABLE public.employee_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  certification_name TEXT NOT NULL,
  certification_type TEXT NOT NULL, -- 'technical', 'compliance', 'professional', 'safety'
  provider TEXT NOT NULL,
  certification_number TEXT,
  issue_date DATE NOT NULL,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'pending_renewal')),
  verification_url TEXT,
  cost DECIMAL(12,2),
  renewal_required BOOLEAN DEFAULT true,
  last_renewal_date DATE,
  next_renewal_date DATE,
  compliance_required BOOLEAN DEFAULT false,
  department TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "certifications_select_policy" ON public.employee_certifications
  FOR SELECT USING (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    ) OR
    employee_id = auth.uid()
  );

CREATE POLICY "certifications_insert_policy" ON public.employee_certifications
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    )
  );

CREATE POLICY "certifications_update_policy" ON public.employee_certifications
  FOR UPDATE USING (
    auth.role() = 'service_role' OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'hr_manager')
    )
  );

-- Create indexes for performance
CREATE INDEX idx_certifications_employee ON public.employee_certifications(employee_id);
CREATE INDEX idx_certifications_status ON public.employee_certifications(status);
CREATE INDEX idx_certifications_expiry ON public.employee_certifications(expiry_date);
CREATE INDEX idx_certifications_type ON public.employee_certifications(certification_type);

-- Insert sample certification data
INSERT INTO public.employee_certifications (
  employee_id, certification_name, certification_type, provider, certification_number,
  issue_date, expiry_date, status, cost, compliance_required, department, skill_level
) 
SELECT 
  emp.id,
  cert_data.name,
  cert_data.type,
  cert_data.provider,
  cert_data.number,
  cert_data.issue_date,
  cert_data.expiry_date,
  cert_data.status,
  cert_data.cost,
  cert_data.compliance_required,
  emp.current_department,
  cert_data.skill_level
FROM (
  SELECT 
    'AWS Certified Solutions Architect' as name,
    'technical' as type,
    'Amazon Web Services' as provider,
    'AWS-CSA-' || (random() * 10000)::int as number,
    CURRENT_DATE - (random() * 365)::int as issue_date,
    CURRENT_DATE + (random() * 730 + 365)::int as expiry_date,
    'active' as status,
    1500.00 as cost,
    false as compliance_required,
    'expert' as skill_level
  UNION ALL
  SELECT 
    'PMP - Project Management Professional',
    'professional',
    'Project Management Institute',
    'PMP-' || (random() * 100000)::int,
    CURRENT_DATE - (random() * 200)::int,
    CURRENT_DATE + (random() * 1095 + 365)::int,
    'active',
    555.00,
    false,
    'advanced'
  UNION ALL
  SELECT 
    'CISSP - Certified Information Systems Security Professional',
    'technical',
    'ISC2',
    'CISSP-' || (random() * 100000)::int,
    CURRENT_DATE - (random() * 300)::int,
    CURRENT_DATE + (random() * 1095 + 365)::int,
    'active',
    749.00,
    true,
    'expert'
  UNION ALL
  SELECT 
    'ITIL 4 Foundation',
    'compliance',
    'PeopleCert',
    'ITIL4-' || (random() * 100000)::int,
    CURRENT_DATE - (random() * 180)::int,
    CURRENT_DATE + (random() * 1095 + 365)::int,
    'active',
    350.00,
    true,
    'intermediate'
  UNION ALL
  SELECT 
    'Scrum Master Certified',
    'professional',
    'Scrum Alliance',
    'CSM-' || (random() * 100000)::int,
    CURRENT_DATE - (random() * 400)::int,
    CURRENT_DATE + (random() * 730 + 365)::int,
    'active',
    995.00,
    false,
    'advanced'
  UNION ALL
  SELECT 
    'Google Cloud Professional Data Engineer',
    'technical',
    'Google Cloud',
    'GCP-PDE-' || (random() * 10000)::int,
    CURRENT_DATE - (random() * 250)::int,
    CURRENT_DATE + (random() * 730 + 365)::int,
    'active',
    200.00,
    false,
    'expert'
  UNION ALL
  SELECT 
    'Microsoft Azure Fundamentals',
    'technical',
    'Microsoft',
    'AZ-900-' || (random() * 10000)::int,
    CURRENT_DATE - (random() * 150)::int,
    CURRENT_DATE + (random() * 730 + 365)::int,
    'active',
    99.00,
    false,
    'beginner'
  UNION ALL
  SELECT 
    'Six Sigma Green Belt',
    'professional',
    'ASQ',
    'SSGB-' || (random() * 100000)::int,
    CURRENT_DATE - (random() * 500)::int,
    CURRENT_DATE + (random() * 1460 + 365)::int,
    'active',
    850.00,
    false,
    'intermediate'
  UNION ALL
  SELECT 
    'CompTIA Security+',
    'compliance',
    'CompTIA',
    'SEC+-' || (random() * 100000)::int,
    CURRENT_DATE - (random() * 300)::int,
    CURRENT_DATE + (random() * 1095 + 365)::int,
    'active',
    370.00,
    true,
    'intermediate'
  UNION ALL
  SELECT 
    'Salesforce Administrator',
    'technical',
    'Salesforce',
    'SF-ADM-' || (random() * 10000)::int,
    CURRENT_DATE - (random() * 200)::int,
    CURRENT_DATE + (random() * 365 + 180)::int,
    'active',
    200.00,
    false,
    'intermediate'
) cert_data
CROSS JOIN (
  SELECT id, current_department 
  FROM public.xlsmart_employees 
  WHERE is_active = true 
  ORDER BY random() 
  LIMIT 45
) emp;

-- Add some expiring certifications for demo
INSERT INTO public.employee_certifications (
  employee_id, certification_name, certification_type, provider, certification_number,
  issue_date, expiry_date, status, cost, compliance_required, department, skill_level
) 
SELECT 
  emp.id,
  'ISO 27001 Lead Auditor',
  'compliance',
  'BSI',
  'ISO27001-' || (random() * 100000)::int,
  CURRENT_DATE - 600,
  CURRENT_DATE + (random() * 60)::int, -- Expiring in next 60 days
  'active',
  1200.00,
  true,
  emp.current_department,
  'advanced'
FROM (
  SELECT id, current_department 
  FROM public.xlsmart_employees 
  WHERE is_active = true 
  ORDER BY random() 
  LIMIT 8
) emp;

-- Add some expired certifications
INSERT INTO public.employee_certifications (
  employee_id, certification_name, certification_type, provider, certification_number,
  issue_date, expiry_date, status, cost, compliance_required, department, skill_level
) 
SELECT 
  emp.id,
  'PRINCE2 Foundation',
  'professional',
  'AXELOS',
  'P2-FOUND-' || (random() * 100000)::int,
  CURRENT_DATE - 800,
  CURRENT_DATE - (random() * 30)::int, -- Expired in last 30 days
  'expired',
  450.00,
  false,
  emp.current_department,
  'intermediate'
FROM (
  SELECT id, current_department 
  FROM public.xlsmart_employees 
  WHERE is_active = true 
  ORDER BY random() 
  LIMIT 5
) emp;



