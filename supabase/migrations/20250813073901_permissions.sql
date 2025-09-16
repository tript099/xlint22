-- Add indexes for better performance with large datasets

-- Index for role mappings by catalog_id (most common query)
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_catalog_id 
ON xlsmart_role_mappings(catalog_id);

-- Index for role mappings by status for filtering
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_status 
ON xlsmart_role_mappings(mapping_status);

-- Index for role mappings by confidence for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_confidence 
ON xlsmart_role_mappings(mapping_confidence DESC);

-- Index for role mappings requiring manual review
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_review 
ON xlsmart_role_mappings(requires_manual_review, catalog_id);

-- Index for role catalogs by upload status
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_catalogs_status 
ON xlsmart_role_catalogs(upload_status);

-- Index for role catalogs by uploaded_by user
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_catalogs_user 
ON xlsmart_role_catalogs(uploaded_by);

-- Index for employees by company for large employee datasets
CREATE INDEX IF NOT EXISTS idx_xlsmart_employees_company 
ON xlsmart_employees(source_company);

-- Index for employees by current position for role matching
CREATE INDEX IF NOT EXISTS idx_xlsmart_employees_position 
ON xlsmart_employees(current_position);

-- Index for standard roles by job family and level for AI matching
CREATE INDEX IF NOT EXISTS idx_xlsmart_standard_roles_family_level 
ON xlsmart_standard_roles(job_family, role_level) WHERE is_active = true;

-- Composite index for efficient mapping queries with pagination
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_composite 
ON xlsmart_role_mappings(catalog_id, mapping_status, mapping_confidence DESC);

-- Index for faster text searches on role titles
CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_original_title 
ON xlsmart_role_mappings USING gin(to_tsvector('english', original_role_title));

CREATE INDEX IF NOT EXISTS idx_xlsmart_role_mappings_standardized_title 
ON xlsmart_role_mappings USING gin(to_tsvector('english', standardized_role_title));