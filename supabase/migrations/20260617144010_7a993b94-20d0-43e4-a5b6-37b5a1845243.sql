-- Fix 1: Prevent connection requesters from self-approving their own requests.
-- Only the addressee may update a connection (e.g. accept/decline); requesters can still cancel via DELETE.
DROP POLICY IF EXISTS "Members can update their connections" ON public.circle_connections;
CREATE POLICY "Addressee can respond to connection requests"
ON public.circle_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);

-- Fix 2: Stop exposing every user's phone number to all signed-in users.
-- Users may read their own profile and profiles of accepted circle members only.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view own and circle profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.are_in_circle(auth.uid(), id));