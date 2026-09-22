BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cover_image_position_x SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_image_position_y SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_image_zoom SMALLINT NOT NULL DEFAULT 100;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_cover_image_position_x_check,
  DROP CONSTRAINT IF EXISTS tenants_cover_image_position_y_check,
  DROP CONSTRAINT IF EXISTS tenants_cover_image_zoom_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_cover_image_position_x_check
    CHECK (cover_image_position_x BETWEEN 0 AND 100),
  ADD CONSTRAINT tenants_cover_image_position_y_check
    CHECK (cover_image_position_y BETWEEN 0 AND 100),
  ADD CONSTRAINT tenants_cover_image_zoom_check
    CHECK (cover_image_zoom BETWEEN 100 AND 200);

-- Addresses under the platform-owned root need no external DNS review. The
-- owner can edit only the tenant label; the application always supplies the
-- immutable yuhbusiness.com suffix.
CREATE OR REPLACE FUNCTION public.guard_tenant_custom_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.custom_domain IS NOT NULL THEN
    NEW.custom_domain := LOWER(TRIM(TRAILING '.' FROM BTRIM(NEW.custom_domain)));
    IF NEW.custom_domain !~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' THEN
      RAISE EXCEPTION 'Enter a valid public custom domain.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.custom_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.yuhbusiness\.com$' THEN
    NEW.custom_domain_verified_at := COALESCE(OLD.custom_domain_verified_at, NOW());
  ELSIF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
    NEW.custom_domain_verified_at := NULL;
  ELSIF NEW.custom_domain_verified_at IS DISTINCT FROM OLD.custom_domain_verified_at
    AND auth.role() <> 'service_role'
    AND NOT public.is_super_admin()
  THEN
    RAISE EXCEPTION 'Only a platform administrator can verify a custom domain.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_yuhbusiness_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.custom_domain IS NULL AND NULLIF(BTRIM(NEW.subdomain), '') IS NOT NULL THEN
    NEW.custom_domain := LOWER(BTRIM(NEW.subdomain)) || '.yuhbusiness.com';
    NEW.custom_domain_verified_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_yuhbusiness_domain ON public.tenants;
CREATE TRIGGER trg_set_default_yuhbusiness_domain
BEFORE INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_default_yuhbusiness_domain();

UPDATE public.tenants
SET custom_domain = LOWER(BTRIM(subdomain)) || '.yuhbusiness.com'
WHERE custom_domain IS NULL
  AND NULLIF(BTRIM(subdomain), '') IS NOT NULL;

UPDATE public.tenants
SET custom_domain_verified_at = COALESCE(custom_domain_verified_at, NOW())
WHERE custom_domain ~* '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.yuhbusiness\.com$';

-- Logos selected during signup share the existing public storefront bucket.
-- Folder-level tenant access remains the write boundary.
DROP POLICY IF EXISTS storefront_media_tenant_insert ON storage.objects;
CREATE POLICY storefront_media_tenant_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] IN ('covers', 'logos')
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::UUID)
  );

DROP POLICY IF EXISTS storefront_media_tenant_update ON storage.objects;
CREATE POLICY storefront_media_tenant_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] IN ('covers', 'logos')
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::UUID)
  )
  WITH CHECK (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] IN ('covers', 'logos')
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::UUID)
  );

DROP POLICY IF EXISTS storefront_media_tenant_delete ON storage.objects;
CREATE POLICY storefront_media_tenant_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] IN ('covers', 'logos')
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::UUID)
  );

COMMIT;
