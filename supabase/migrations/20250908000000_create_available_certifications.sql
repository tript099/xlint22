-- Create available_certifications table for certifications that employees can opt into
CREATE TABLE IF NOT EXISTS public.available_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_name TEXT NOT NULL,
    issuing_authority TEXT,
    description TEXT,
    duration TEXT,
    cost NUMERIC,
    external_url TEXT,
    requirements TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.available_certifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read available certifications
CREATE POLICY "Allow authenticated users to read available certifications"
ON public.available_certifications
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert available certifications
CREATE POLICY "Allow authenticated users to insert available certifications"
ON public.available_certifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update available certifications
CREATE POLICY "Allow authenticated users to update available certifications"
ON public.available_certifications
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete available certifications
CREATE POLICY "Allow authenticated users to delete available certifications"
ON public.available_certifications
FOR DELETE
TO authenticated
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_available_certifications_name ON available_certifications(certification_name);
CREATE INDEX idx_available_certifications_active ON available_certifications(is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_available_certifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_available_certifications_updated_at
    BEFORE UPDATE ON available_certifications
    FOR EACH ROW
    EXECUTE FUNCTION update_available_certifications_updated_at();
