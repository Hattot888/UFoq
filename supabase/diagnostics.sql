-- ==============================================================================
-- HORIZON CONTEMPORARY ART GALLERY (معرض أفق للفنون المعاصرة)
-- Read-Only Diagnostics Script: Security Audit & Permissions Verification
-- ==============================================================================
-- Safe to run in Supabase SQL Editor at any time.
-- This script performs zero modifications; it inspects metadata, privileges,
-- functions, and RLS policies on all four application tables.
-- ==============================================================================

-- 1. FUNCTION AUDIT: Inspect public.is_admin() and public.get_product_popularity()
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END AS volatility,
    r.rolname AS owner,
    p.proconfig AS config_settings -- shows search_path settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'get_product_popularity')
ORDER BY p.proname;

-- 2. FUNCTION EXECUTION PRIVILEGES: Verify who can execute the functions
SELECT
    routine_schema,
    routine_name,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'get_product_popularity')
ORDER BY routine_name, grantee;


-- 3. TABLE ROW LEVEL SECURITY (RLS) STATUS
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n
    ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'products',
      'admin_users',
      'analytics_events',
      'demo_orders'
  )
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 4. TABLE-LEVEL PRIVILEGES: Verify GRANTs for anon, authenticated, and service_role
SELECT
    table_schema,
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'admin_users', 'analytics_events', 'demo_orders')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- 5. ROW LEVEL SECURITY POLICIES: Complete inspection of all active RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd AS operation,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'admin_users', 'analytics_events', 'demo_orders')
ORDER BY tablename, policyname;

-- 6. ADMIN USERS TABLE POPULATION CHECK: Verify if admin records exist
-- (Counts rows without displaying sensitive user UUIDs or emails)
SELECT
    COUNT(*) AS total_admin_records,
    COUNT(*) FILTER (WHERE role = 'admin') AS admin_count,
    COUNT(*) FILTER (WHERE role = 'super_admin') AS super_admin_count
FROM public.admin_users;

-- 7. EVENT TYPES CHECK: Inspect event_type distribution in analytics_events
SELECT
    event_type,
    COUNT(*) AS event_count,
    MIN(created_at) AS earliest_event,
    MAX(created_at) AS latest_event
FROM public.analytics_events
GROUP BY event_type
ORDER BY event_count DESC;
