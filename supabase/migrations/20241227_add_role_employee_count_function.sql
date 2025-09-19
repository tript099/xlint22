-- Create function to efficiently get employee counts for multiple roles
CREATE OR REPLACE FUNCTION get_role_employee_counts(role_titles text[])
RETURNS TABLE (
  role_title text,
  employee_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    unnest(role_titles) as role_title,
    COALESCE(counts.employee_count, 0) as employee_count
  FROM (
    SELECT 
      current_position as role_title,
      COUNT(*) as employee_count
    FROM xlsmart_employees 
    WHERE current_position = ANY(role_titles)
    GROUP BY current_position
  ) counts
  RIGHT JOIN unnest(role_titles) roles(role_title) ON counts.role_title = roles.role_title;
$$;

-- Add indexes for better performance on role-related queries
CREATE INDEX IF NOT EXISTS idx_xlsmart_employees_current_position 
ON xlsmart_employees(current_position);

CREATE INDEX IF NOT EXISTS idx_xlsmart_standard_roles_title_dept_level 
ON xlsmart_standard_roles(role_title, department, role_level);

CREATE INDEX IF NOT EXISTS idx_xlsmart_standard_roles_search 
ON xlsmart_standard_roles USING gin(to_tsvector('english', role_title || ' ' || COALESCE(department, '') || ' ' || COALESCE(role_level, '')));

-- Add comment for documentation
COMMENT ON FUNCTION get_role_employee_counts(text[]) IS 'Efficiently returns employee counts for multiple role titles in a single query';