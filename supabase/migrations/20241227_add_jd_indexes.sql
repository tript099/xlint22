-- Create strategic indexes for job description queries
CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_status_created 
ON xlsmart_job_descriptions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_title_search 
ON xlsmart_job_descriptions USING gin(to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_summary_search 
ON xlsmart_job_descriptions USING gin(to_tsvector('english', COALESCE(summary, '')));

CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_composite_search 
ON xlsmart_job_descriptions(status, experience_level, employment_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_ai_generated 
ON xlsmart_job_descriptions(ai_generated, status, created_at DESC);

-- Create function for efficient JD status counts
CREATE OR REPLACE FUNCTION get_jd_status_counts()
RETURNS TABLE (
  status text,
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    status,
    COUNT(*) as count
  FROM xlsmart_job_descriptions 
  GROUP BY status;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_jd_status_counts() IS 'Efficiently returns job description counts grouped by status';

-- Create index for recent JDs query optimization
CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_recent 
ON xlsmart_job_descriptions(created_at DESC) 
WHERE created_at >= (CURRENT_DATE - INTERVAL '30 days');

-- Create partial indexes for specific status queries (more efficient)
CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_published 
ON xlsmart_job_descriptions(created_at DESC) 
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_xlsmart_job_descriptions_draft_review 
ON xlsmart_job_descriptions(created_at DESC) 
WHERE status IN ('draft', 'review');