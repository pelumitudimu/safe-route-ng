
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.incident_category AS ENUM ('robbery','kidnapping','assault','theft','accident','protest','fire','fraud','harassment','other');
CREATE TYPE public.incident_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.incident_status AS ENUM ('pending','verified','disputed','resolved');
CREATE TYPE public.verification_vote AS ENUM ('confirm','dispute');

-- ===== updated_at helper =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ===== NEW USER TRIGGER =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== INCIDENTS =====
CREATE TABLE public.incidents (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.incident_category NOT NULL,
  severity public.incident_severity NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  photo_url TEXT,
  status public.incident_status NOT NULL DEFAULT 'pending',
  confirm_count INTEGER NOT NULL DEFAULT 0,
  dispute_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Incidents are publicly viewable" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Authenticated users can report incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporters can update their incidents" ON public.incidents FOR UPDATE TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Reporters can delete their incidents" ON public.incidents FOR DELETE TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_incidents_created_at ON public.incidents (created_at DESC);
CREATE INDEX idx_incidents_location ON public.incidents (latitude, longitude);

-- ===== VERIFICATIONS =====
CREATE TABLE public.incident_verifications (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote public.verification_vote NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_verifications TO authenticated;
GRANT ALL ON public.incident_verifications TO service_role;
ALTER TABLE public.incident_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verifications are viewable by authenticated users" ON public.incident_verifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can vote" ON public.incident_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change their vote" ON public.incident_verifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their vote" ON public.incident_verifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- recalc counts + status
CREATE OR REPLACE FUNCTION public.recalc_incident_votes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _incident_id UUID;
  _confirm INTEGER;
  _dispute INTEGER;
  _new_status public.incident_status;
BEGIN
  _incident_id := COALESCE(NEW.incident_id, OLD.incident_id);
  SELECT count(*) FILTER (WHERE vote = 'confirm'), count(*) FILTER (WHERE vote = 'dispute')
    INTO _confirm, _dispute
  FROM public.incident_verifications WHERE incident_id = _incident_id;

  SELECT status INTO _new_status FROM public.incidents WHERE id = _incident_id;
  IF _new_status NOT IN ('resolved') THEN
    IF _confirm >= 3 AND _confirm > _dispute THEN
      _new_status := 'verified';
    ELSIF _dispute >= 3 AND _dispute > _confirm THEN
      _new_status := 'disputed';
    ELSE
      _new_status := 'pending';
    END IF;
  END IF;

  UPDATE public.incidents
    SET confirm_count = _confirm, dispute_count = _dispute, status = _new_status
  WHERE id = _incident_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER recalc_votes_ins AFTER INSERT ON public.incident_verifications FOR EACH ROW EXECUTE FUNCTION public.recalc_incident_votes();
CREATE TRIGGER recalc_votes_upd AFTER UPDATE ON public.incident_verifications FOR EACH ROW EXECUTE FUNCTION public.recalc_incident_votes();
CREATE TRIGGER recalc_votes_del AFTER DELETE ON public.incident_verifications FOR EACH ROW EXECUTE FUNCTION public.recalc_incident_votes();

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

-- ===== SOS ALERTS =====
CREATE TABLE public.sos_alerts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sos_alerts TO authenticated;
GRANT ALL ON public.sos_alerts TO service_role;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their SOS alerts" ON public.sos_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create SOS alerts" ON public.sos_alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their SOS alerts" ON public.sos_alerts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
