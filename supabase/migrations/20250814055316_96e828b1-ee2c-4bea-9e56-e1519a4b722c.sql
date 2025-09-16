-- Clean up the recent test data to retest properly
DELETE FROM xlsmart_standard_roles WHERE created_at > '2025-08-14 05:49:00';
DELETE FROM xlsmart_role_catalogs WHERE created_at > '2025-08-14 05:49:00';
DELETE FROM xl_roles_data WHERE session_id = '2c0a9492-aaff-4b23-a8ec-ebda9616adca';
DELETE FROM smart_roles_data WHERE session_id = '2c0a9492-aaff-4b23-a8ec-ebda9616adca';
DELETE FROM xlsmart_upload_sessions WHERE id = '2c0a9492-aaff-4b23-a8ec-ebda9616adca';