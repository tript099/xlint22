-- Remove the duplicate "Unknown Role" that's causing the constraint violation
DELETE FROM xlsmart_standard_roles WHERE role_title = 'Unknown Role';

-- Update the standardization function to handle duplicates better
-- First, let's check the uploaded role data to see what we're working with
SELECT role_title, department, role_family, core_responsibilities 
FROM xl_roles_data 
WHERE session_id = 'da6f5501-a4d0-455b-83be-05d63e34916a' 
LIMIT 5;