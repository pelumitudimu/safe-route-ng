-- Fix 1: incident_verifications — restrict SELECT to the user's own votes only
DROP POLICY IF EXISTS "Verifications are viewable by authenticated users" ON public.incident_verifications;
CREATE POLICY "Users can view their own verifications"
  ON public.incident_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix 2: notifications — remove the broad authenticated INSERT policy.
-- Notifications are only created by trusted server-side logic:
--   * the notify_circle_on_sos() SECURITY DEFINER trigger
--   * server functions using the service role (which bypass RLS)
DROP POLICY IF EXISTS "Users can insert their notifications" ON public.notifications;

-- Fix 5: SECURITY DEFINER helper functions executable by signed-in users.
-- De-recurse the user_roles SELECT policy so has_role can safely run as INVOKER.
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Switch helpers to SECURITY INVOKER. Both are only ever called with the
-- caller (auth.uid()) as a subject, so RLS on the underlying tables lets the
-- caller read their own rows while blocking direct RPC probing of other users.
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY INVOKER;
ALTER FUNCTION public.are_in_circle(uuid, uuid) SECURITY INVOKER;