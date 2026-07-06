-- Add flags column to scan_history for storing scam-detection flags (e.g. "Upfront Fee", "Pressure Tactics")
ALTER TABLE public.scan_history ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]'::jsonb;
