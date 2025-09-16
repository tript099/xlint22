-- Clear All Role Data Script
-- This will delete all role-related data to start fresh

-- Delete role mappings first (has foreign key constraints)
DELETE FROM xlsmart_role_mappings;

-- Delete job descriptions that reference roles
DELETE FROM xlsmart_job_descriptions;

-- Delete employee role assignments
UPDATE xlsmart_employees SET 
  standard_role_id = NULL,
  ai_suggested_role_id = NULL,
  original_role_title = NULL,
  role_assignment_status = 'pending',
  assigned_by = NULL,
  assignment_notes = NULL;

-- Delete uploaded role data
DELETE FROM xl_roles_data;
DELETE FROM smart_roles_data;

-- Delete role catalogs
DELETE FROM xlsmart_role_catalogs;

-- Delete upload sessions
DELETE FROM xlsmart_upload_sessions;

-- Delete standard roles (but keep the system-created ones if needed)
-- Uncomment the next line if you want to delete ALL standard roles too
-- DELETE FROM xlsmart_standard_roles;

-- Reset sequences if needed
-- ALTER SEQUENCE IF EXISTS some_sequence_name RESTART WITH 1;

-- Show remaining counts
SELECT 
  'xl_roles_data' as table_name, 
  COUNT(*) as remaining_records 
FROM xl_roles_data
UNION ALL
SELECT 
  'smart_roles_data' as table_name, 
  COUNT(*) as remaining_records 
FROM smart_roles_data
UNION ALL
SELECT 
  'xlsmart_role_mappings' as table_name, 
  COUNT(*) as remaining_records 
FROM xlsmart_role_mappings
UNION ALL
SELECT 
  'xlsmart_upload_sessions' as table_name, 
  COUNT(*) as remaining_records 
FROM xlsmart_upload_sessions
UNION ALL
SELECT 
  'xlsmart_role_catalogs' as table_name, 
  COUNT(*) as remaining_records 
FROM xlsmart_role_catalogs
UNION ALL
SELECT 
  'xlsmart_standard_roles' as table_name, 
  COUNT(*) as remaining_records 
FROM xlsmart_standard_roles;
