-- Supabase SQL DDL Schema for ScamShield Scans Table

CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    input_type TEXT NOT NULL CHECK (input_type IN ('text', 'url', 'pdf')),
    raw_content TEXT NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
    summary TEXT,
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Allow public read access for recent scan history display
CREATE POLICY "Allow public read access" ON public.scans
    FOR SELECT USING (true);

-- Allow public insert access for logging scan results
CREATE POLICY "Allow public insert access" ON public.scans
    FOR INSERT WITH CHECK (true);
