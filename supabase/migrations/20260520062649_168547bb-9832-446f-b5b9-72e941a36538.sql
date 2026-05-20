
CREATE TABLE public.scam_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports"
ON public.scam_reports FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own reports"
ON public.scam_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
ON public.scam_reports FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_scam_reports_created_at ON public.scam_reports(created_at DESC);
