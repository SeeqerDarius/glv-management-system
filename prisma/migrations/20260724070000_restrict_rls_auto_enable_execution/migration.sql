-- This SECURITY DEFINER function is invoked only by the ensure_rls event
-- trigger. It must not be callable through PostgREST RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM service_role;
