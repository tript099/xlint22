-- First, let's update the existing "Unknown Role" to be more specific
-- since it's referenced by a job description
UPDATE xlsmart_standard_roles 
SET 
  role_title = 'RAN Engineer',
  department = 'RAN Engineering',
  job_family = 'Engineering',
  role_category = 'Technical',
  standard_description = 'Radio Access Network Engineer responsible for NodeB/eNB/gNB operations and L3 integration'
WHERE role_title = 'Unknown Role';

-- Now create proper standard roles based on the uploaded data
INSERT INTO xlsmart_standard_roles (
  role_title, 
  job_family, 
  role_level, 
  role_category, 
  department, 
  standard_description,
  required_skills,
  experience_range_min,
  experience_range_max,
  created_by
) VALUES 
-- RAN Engineering roles
('RAN Performance Engineer', 'Engineering', 'Senior', 'Technical', 'RAN Engineering', 
 'Senior RAN Performance Engineer responsible for network optimization and performance analysis',
 '["NodeB/eNB/gNB", "L3 Integration", "eRan", "NB-IoT", "Carrier Aggregation", "NR-SA"]',
 4, 8, '00000000-0000-0000-0000-000000000000'),

-- Core Network roles  
('5GC Core Engineer', 'Engineering', 'Senior', 'Technical', 'Core Network',
 'Core Network Engineer specializing in 5G Core functions and CUPS architecture',
 '["SMF", "UPF", "N4", "PFCP", "CUPS", "K8s"]',
 5, 10, '00000000-0000-0000-0000-000000000000'),

('IMS Core Engineer', 'Engineering', 'Senior', 'Technical', 'Core Network',
 'IMS Core Engineer responsible for SIP-based voice and multimedia services',
 '["P-CSCF/S-CSCF", "SIP", "HSS/UDM", "SRVCC", "SBC", "QoS"]',
 4, 8, '00000000-0000-0000-0000-000000000000')

ON CONFLICT (role_title) DO NOTHING;