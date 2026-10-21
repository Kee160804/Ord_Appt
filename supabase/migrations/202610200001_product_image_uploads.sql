BEGIN;

-- Product photos share the public storefront media bucket. Tenant access to
-- the first path segment remains the write boundary.
DROP POLICY IF EXISTS storefront_media_product_insert ON storage.objects;
CREATE POLICY storefront_media_product_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'products'
    AND public.user_has_tenant_access(
      ((storage.foldername(name))[1])::UUID
    )
  );

DROP POLICY IF EXISTS storefront_media_product_update ON storage.objects;
CREATE POLICY storefront_media_product_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'products'
    AND public.user_has_tenant_access(
      ((storage.foldername(name))[1])::UUID
    )
  )
  WITH CHECK (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'products'
    AND public.user_has_tenant_access(
      ((storage.foldername(name))[1])::UUID
    )
  );

DROP POLICY IF EXISTS storefront_media_product_delete ON storage.objects;
CREATE POLICY storefront_media_product_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'products'
    AND public.user_has_tenant_access(
      ((storage.foldername(name))[1])::UUID
    )
  );

COMMIT;
