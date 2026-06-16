
CREATE POLICY "Incident photos are viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'incident-photos');

CREATE POLICY "Users can upload incident photos to their folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their incident photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'incident-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their incident photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'incident-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
