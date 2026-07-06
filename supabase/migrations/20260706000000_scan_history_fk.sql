ALTER TABLE public.scan_history ADD CONSTRAINT scan_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
