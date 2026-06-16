REVOKE EXECUTE ON FUNCTION public.notify_circle_on_sos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.are_in_circle(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_in_circle(uuid, uuid) TO authenticated;