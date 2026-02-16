
-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false);

-- RLS: Users can upload their own backups
CREATE POLICY "Users can upload own backups"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can view their own backups
CREATE POLICY "Users can view own backups"
ON storage.objects FOR SELECT
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete their own backups
CREATE POLICY "Users can delete own backups"
ON storage.objects FOR DELETE
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can update their own backups
CREATE POLICY "Users can update own backups"
ON storage.objects FOR UPDATE
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);
