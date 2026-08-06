DROP POLICY IF EXISTS "Anyone can view customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload customer photos" ON storage.objects;

CREATE POLICY "Users can view own customer photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'customer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own customer photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own customer photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'customer-photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'customer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own customer photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'customer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);