-- Insert sample certification data with fixed employee references
-- First, let's get actual employee IDs and insert certifications directly

DO $$
DECLARE
    emp_record RECORD;
    cert_names TEXT[] := ARRAY[
        'AWS Certified Solutions Architect',
        'PMP - Project Management Professional',
        'CISSP - Certified Information Systems Security Professional',
        'ITIL 4 Foundation',
        'Scrum Master Certified',
        'Google Cloud Professional Data Engineer',
        'Microsoft Azure Fundamentals',
        'Six Sigma Green Belt',
        'CompTIA Security+',
        'Salesforce Administrator',
        'ISO 27001 Lead Auditor',
        'PRINCE2 Foundation',
        'Certified Kubernetes Administrator',
        'Oracle Database Administrator',
        'VMware vSphere Certified'
    ];
    cert_types TEXT[] := ARRAY['technical', 'professional', 'compliance'];
    providers TEXT[] := ARRAY[
        'Amazon Web Services', 'Project Management Institute', 'ISC2', 
        'PeopleCert', 'Scrum Alliance', 'Google Cloud', 'Microsoft',
        'ASQ', 'CompTIA', 'Salesforce', 'BSI', 'AXELOS', 'CNCF', 'Oracle', 'VMware'
    ];
    cert_counter INTEGER := 0;
BEGIN
    -- Loop through active employees and assign certifications
    FOR emp_record IN 
        SELECT id, current_department, first_name, last_name 
        FROM public.xlsmart_employees 
        WHERE is_active = true 
        ORDER BY created_at 
        LIMIT 50
    LOOP
        -- Give each employee 1-3 random certifications
        FOR i IN 1..(1 + (random() * 2)::int) LOOP
            cert_counter := cert_counter + 1;
            
            INSERT INTO public.employee_certifications (
                employee_id,
                certification_name,
                certification_type,
                provider,
                certification_number,
                issue_date,
                expiry_date,
                status,
                cost,
                compliance_required,
                department,
                skill_level
            ) VALUES (
                emp_record.id,
                cert_names[1 + (random() * (array_length(cert_names, 1) - 1))::int],
                cert_types[1 + (random() * (array_length(cert_types, 1) - 1))::int],
                providers[1 + (random() * (array_length(providers, 1) - 1))::int],
                'CERT-' || cert_counter || '-' || (random() * 10000)::int,
                CURRENT_DATE - (random() * 365)::int,
                CURRENT_DATE + (random() * 730 + 365)::int,
                CASE 
                    WHEN random() > 0.1 THEN 'active'
                    ELSE 'expired'
                END,
                (200 + random() * 1500)::decimal(12,2),
                random() > 0.7,
                emp_record.current_department,
                CASE 
                    WHEN random() < 0.2 THEN 'beginner'
                    WHEN random() < 0.5 THEN 'intermediate'
                    WHEN random() < 0.8 THEN 'advanced'
                    ELSE 'expert'
                END
            );
        END LOOP;
    END LOOP;
    
    -- Add some expiring certifications
    UPDATE public.employee_certifications 
    SET expiry_date = CURRENT_DATE + (random() * 90)::int
    WHERE random() < 0.15;
    
    RAISE NOTICE 'Inserted % certifications', cert_counter;
END $$;



