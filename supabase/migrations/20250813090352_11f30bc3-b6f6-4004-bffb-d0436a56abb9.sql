-- Delete all roles and skills data for fresh testing
-- Delete in order to avoid foreign key constraint violations
-- Using safe deletions that only run if tables exist

-- Delete skill assessments first (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_skill_assessments') THEN
    DELETE FROM xlsmart_skill_assessments;
  END IF;
END $$;

-- Delete development plans (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_development_plans') THEN
    DELETE FROM xlsmart_development_plans;
  END IF;
END $$;

-- Delete job descriptions (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_job_descriptions') THEN
    DELETE FROM xlsmart_job_descriptions;
  END IF;
END $$;

-- Delete role mappings (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_role_mappings') THEN
    DELETE FROM xlsmart_role_mappings;
  END IF;
END $$;

-- Delete role catalogs (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_role_catalogs') THEN
    DELETE FROM xlsmart_role_catalogs;
  END IF;
END $$;

-- Delete xlsmart employees (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_employees') THEN
    DELETE FROM xlsmart_employees;
  END IF;
END $$;

-- Delete standard roles (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'xlsmart_standard_roles') THEN
    DELETE FROM xlsmart_standard_roles;
  END IF;
END $$;

-- Delete skills master (safe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'skills_master') THEN
    DELETE FROM skills_master;
  END IF;
END $$;