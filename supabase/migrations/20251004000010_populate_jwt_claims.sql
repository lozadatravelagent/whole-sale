-- Populate JWT claims with user role, agency_id, and tenant_id
-- This allows helper functions to read from JWT instead of querying users table

-- Create function to update auth.users app_metadata
CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update auth.users app_metadata with user role and IDs
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_build_object(
    'user_role', NEW.role::text,
    'agency_id', NEW.agency_id::text,
    'tenant_id', NEW.tenant_id::text
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger to update JWT claims when users table changes
DROP TRIGGER IF EXISTS update_user_metadata_trigger ON public.users;
CREATE TRIGGER update_user_metadata_trigger
  AFTER INSERT OR UPDATE OF role, agency_id, tenant_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_metadata_update();

-- Populate existing users' JWT claims
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id, role, agency_id, tenant_id FROM public.users LOOP
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_build_object(
      'user_role', user_record.role::text,
      'agency_id', user_record.agency_id::text,
      'tenant_id', user_record.tenant_id::text
    )
    WHERE id = user_record.id;
  END LOOP;
END $$;
