-- Simple migration to fix existing "Unknown Role" entries
-- This will update role titles that were incorrectly set to "Unknown Role"

-- First, let's see what we have
SELECT 'Before fix - XL roles with Unknown Role:' as info, COUNT(*) as count 
FROM xl_roles_data WHERE role_title = 'Unknown Role'
UNION ALL
SELECT 'Before fix - SMART roles with Unknown Role:' as info, COUNT(*) as count 
FROM smart_roles_data WHERE role_title = 'Unknown Role';

-- Simple approach: Update based on available data
-- If role_id has a meaningful value, use it as the title
UPDATE xl_roles_data 
SET role_title = role_id
WHERE role_title = 'Unknown Role'
AND role_id IS NOT NULL 
AND role_id != ''
AND role_id != 'null';

UPDATE smart_roles_data 
SET role_title = role_id
WHERE role_title = 'Unknown Role'
AND role_id IS NOT NULL 
AND role_id != ''
AND role_id != 'null';

-- If department has a meaningful value, use it as the title
UPDATE xl_roles_data 
SET role_title = department
WHERE role_title = 'Unknown Role'
AND department IS NOT NULL 
AND department != ''
AND department != 'null';

UPDATE smart_roles_data 
SET role_title = department
WHERE role_title = 'Unknown Role'
AND department IS NOT NULL 
AND department != ''
AND department != 'null';

-- If role_family has a meaningful value, use it as the title
UPDATE xl_roles_data 
SET role_title = role_family
WHERE role_title = 'Unknown Role'
AND role_family IS NOT NULL 
AND role_family != ''
AND role_family != 'null';

UPDATE smart_roles_data 
SET role_title = role_family
WHERE role_title = 'Unknown Role'
AND role_family IS NOT NULL 
AND role_family != ''
AND role_family != 'null';

-- Show the results
SELECT 'After fix - XL roles with Unknown Role:' as info, COUNT(*) as count 
FROM xl_roles_data WHERE role_title = 'Unknown Role'
UNION ALL
SELECT 'After fix - SMART roles with Unknown Role:' as info, COUNT(*) as count 
FROM smart_roles_data WHERE role_title = 'Unknown Role';
