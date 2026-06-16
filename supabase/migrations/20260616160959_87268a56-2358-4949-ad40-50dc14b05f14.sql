-- =========================================================
-- Emergency contacts (manual phone list)
-- =========================================================
CREATE TABLE public.emergency_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text,
  notify_on_sos boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own emergency contacts"
  ON public.emergency_contacts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_emergency_contacts_updated_at
  BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Circle connections (family & friends who are app users)
-- =========================================================
CREATE TABLE public.circle_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id),
  CHECK (status IN ('pending','accepted','declined'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_connections TO authenticated;
GRANT ALL ON public.circle_connections TO service_role;

ALTER TABLE public.circle_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their connections"
  ON public.circle_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can request connections"
  ON public.circle_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Members can update their connections"
  ON public.circle_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Members can remove their connections"
  ON public.circle_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER update_circle_connections_updated_at
  BEFORE UPDATE ON public.circle_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Are two users in an accepted circle together?
CREATE OR REPLACE FUNCTION public.are_in_circle(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_connections
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  )
$$;

-- =========================================================
-- Live user locations
-- =========================================================
CREATE TABLE public.user_locations (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision,
  longitude double precision,
  sharing_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_locations TO authenticated;
GRANT ALL ON public.user_locations TO service_role;

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own and circle locations"
  ON public.user_locations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (sharing_enabled AND public.are_in_circle(auth.uid(), user_id))
  );

CREATE POLICY "Users insert own location"
  ON public.user_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own location"
  ON public.user_locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own location"
  ON public.user_locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_locations_updated_at
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Notify accepted circle members when an SOS is raised
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_circle_on_sos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  SELECT COALESCE(display_name, 'A contact') INTO _name
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type)
  SELECT
    CASE WHEN cc.requester_id = NEW.user_id THEN cc.addressee_id ELSE cc.requester_id END,
    '🚨 SOS from ' || _name,
    COALESCE(NEW.message, _name || ' triggered an emergency SOS. Check their location now.'),
    'danger'
  FROM public.circle_connections cc
  WHERE cc.status = 'accepted'
    AND (cc.requester_id = NEW.user_id OR cc.addressee_id = NEW.user_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_circle_on_sos
  AFTER INSERT ON public.sos_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_on_sos();