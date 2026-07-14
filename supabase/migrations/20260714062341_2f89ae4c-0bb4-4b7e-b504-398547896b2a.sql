-- Lock down SECURITY DEFINER function so signed-in users can't invoke it via RPC.
-- RLS policies still work because policies run in the definer context, not via EXECUTE grant on the API role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Explicit deny for INSERT/UPDATE/DELETE on user_roles by end users.
-- Role management must go through service_role / trusted server-side logic only.
CREATE POLICY "Deny inserts by end users"
  ON public.user_roles
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny updates by end users"
  ON public.user_roles
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny deletes by end users"
  ON public.user_roles
  FOR DELETE
  TO authenticated, anon
  USING (false);