-- Create table to track temporary upload sessions
CREATE TABLE IF NOT EXISTS xlsmart_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL,
  file_names TEXT[] NOT NULL,
  temp_table_names TEXT[] NOT NULL,
  total_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'analyzing', 'standardizing', 'completed', 'failed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_message TEXT,
  ai_analysis JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE xlsmart_upload_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "HR managers can manage upload sessions" 
ON xlsmart_upload_sessions 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['super_admin'::text, 'hr_manager'::text]));

-- Create function to safely drop temporary tables
CREATE OR REPLACE FUNCTION drop_temp_tables(table_names TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY table_names
  LOOP
    -- Only drop tables that start with temp_roles_ for safety
    IF table_name LIKE 'temp_roles_%' THEN
      EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', table_name);
    END IF;
  END LOOP;
END;
$$;