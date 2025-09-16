-- Re-add the AWS certification for Abhishek Yadav since it was removed in cleanup

-- Insert the AWS certification that was legitimately assigned
INSERT INTO public.employee_certifications (
  employee_id,
  certification_name,
  certification_type,
  provider,
  issue_date,
  expiry_date,
  status
) 
SELECT 
  emp.id,
  'AWS SOLUTIONS ARCHITECT',
  'professional',
  'SIMPLIFY AI',
  '2025-09-08',
  '2025-09-30',
  'active'
FROM public.xlsmart_employees emp
WHERE emp.first_name = 'Abhishek' AND emp.last_name = 'Yadav'
LIMIT 1;
