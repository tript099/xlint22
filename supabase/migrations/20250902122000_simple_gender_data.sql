-- Add simple sample gender data to test compensation analysis

-- First, let's update the first 50% of employees to Male
UPDATE xlsmart_employees 
SET gender = 'Male'
WHERE gender IS NULL 
  AND is_active = true 
  AND id IN (
    SELECT id FROM xlsmart_employees 
    WHERE gender IS NULL AND is_active = true 
    ORDER BY created_at 
    LIMIT (SELECT COUNT(*) / 2 FROM xlsmart_employees WHERE gender IS NULL AND is_active = true)
  );

-- Then update the remaining employees to Female
UPDATE xlsmart_employees 
SET gender = 'Female'
WHERE gender IS NULL AND is_active = true;
