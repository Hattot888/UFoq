-- ==============================================================================
-- HORIZON CONTEMPORARY ART GALLERY (معرض أفق للفنون المعاصرة)
-- SQL Migration: Security Audit & Permissions Repair
-- File: supabase/migration_fix_permissions.sql
-- ==============================================================================
-- Description:
--   1. Implements safe SECURITY DEFINER public.is_admin() with empty search_path.
--   2. Secures public.get_product_popularity() with empty search_path & active filter.
--   3. Explicitly configures table-level privileges (GRANT/REVOKE) for all roles:
--      - Explicitly revokes all write access (INSERT, UPDATE, DELETE) on admin_users.
--      - Limits anon to read active products and insert telemetry & demo orders.
--      - Limits authenticated reads to self-admin checks, active products, and
--        admin-restricted analytics/orders/management.
--   4. Configures hardened Row Level Security (RLS) policies for:
--      - public.products
--      - public.admin_users
--      - public.analytics_events
--      - public.demo_orders
--   5. Refreshes PostgREST schema cache to resolve 404 RPC and 403 analytics errors.
--
-- Safety:
--   - Wrapped in a transaction (BEGIN ... COMMIT).
--   - Safe to re-run (idempotent).
--   - Does NOT delete or truncate any existing data records.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. SECURITY FUNCTIONS
-- ==============================================================================

-- A. Fix public.is_admin() safely
-- Requirements:
-- - Returns BOOLEAN (never NULL).
-- - Identifies authenticated user via auth.uid().
-- - Returns TRUE only when matching role IN ('admin', 'super_admin').
-- - SECURITY DEFINER prevents RLS recursion and allows reading admin_users safely.
-- - SET search_path = '' prevents search-path hijacking attacks.
-- - STABLE allows query optimizer to cache result within a statement.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- Ensure function ownership is postgres (standard Supabase administrative role)
ALTER FUNCTION public.is_admin() OWNER TO postgres;

-- Revoke execution from PUBLIC and anon (anonymous users can NEVER be admins)
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;


-- B. Secure public.get_product_popularity()
-- Requirements:
-- - Called by storefront (storefront.js) to sort artworks by real popularity.
-- - Must NOT expose visitor_id, session_id, user_id, page_path, or metadata.
-- - Only aggregates view counts for active products.
-- - SECURITY DEFINER allows anon/authenticated to get aggregate view counts
--   without having direct SELECT table access to raw analytics_events.
-- - SET search_path = '' prevents search-path hijacking.
-- - STABLE optimizes aggregation execution.
CREATE OR REPLACE FUNCTION public.get_product_popularity()
RETURNS TABLE (
    product_id UUID,
    view_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT
        ae.product_id,
        COUNT(*)::BIGINT AS view_count
    FROM public.analytics_events ae
    INNER JOIN public.products p ON p.id = ae.product_id
    WHERE ae.event_type = 'product_view'
      AND ae.product_id IS NOT NULL
      AND p.is_active = true
    GROUP BY ae.product_id;
$$;

ALTER FUNCTION public.get_product_popularity() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_product_popularity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_popularity() TO anon, authenticated, service_role;


-- ==============================================================================
-- 2. TABLE-LEVEL PRIVILEGES (GRANTs & REVOKEs)
-- ==============================================================================

-- A. Products Table
REVOKE ALL ON public.products FROM PUBLIC;
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.products FROM authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.products FROM anon, authenticated;
GRANT ALL ON public.products TO service_role;

-- B. Admin Users Table (Strictly restricted; NEVER writeable by clients)
REVOKE ALL ON public.admin_users FROM PUBLIC;
REVOKE ALL ON public.admin_users FROM anon;
REVOKE ALL ON public.admin_users FROM authenticated;
-- Grant ONLY SELECT to authenticated users so they can verify their own role
GRANT SELECT ON public.admin_users TO authenticated;
-- Explicitly enforce zero write permissions on admin_users for authenticated clients
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.admin_users FROM authenticated;
GRANT ALL ON public.admin_users TO service_role;

-- C. Analytics Events Table
REVOKE ALL ON public.analytics_events FROM PUBLIC;
REVOKE ALL ON public.analytics_events FROM anon;
REVOKE ALL ON public.analytics_events FROM authenticated;
-- Anonymous visitors can insert events only
GRANT INSERT ON public.analytics_events TO anon;
-- Authenticated users can insert events and read events (RLS limits read to admins)
GRANT INSERT, SELECT ON public.analytics_events TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.analytics_events FROM anon, authenticated;
GRANT ALL ON public.analytics_events TO service_role;

-- D. Demo Orders Table
REVOKE ALL ON public.demo_orders FROM PUBLIC;
REVOKE ALL ON public.demo_orders FROM anon;
REVOKE ALL ON public.demo_orders FROM authenticated;
-- Anonymous visitors can submit demo orders
GRANT INSERT ON public.demo_orders TO anon;
-- Authenticated users can insert orders and read orders (RLS limits read to admins)
GRANT INSERT, SELECT ON public.demo_orders TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.demo_orders FROM anon, authenticated;
GRANT ALL ON public.demo_orders TO service_role;


-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Ensure RLS is enabled on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_orders ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. PRODUCTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public visitors can read active products" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
-- Drop potential conflicting policies from previous migrations
DROP POLICY IF EXISTS "Allow public read active products" ON public.products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Enable update for users" ON public.products;
DROP POLICY IF EXISTS "Enable delete for users" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;

-- Public visitors and authenticated users can view active products
CREATE POLICY "Public visitors can read active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Verified administrators can view all products (including inactive artworks)
-- CRITICAL: Scoped TO authenticated so anon queries never evaluate this policy!
CREATE POLICY "Admins can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Only verified administrators can insert products
CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Only verified administrators can update products
CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Only verified administrators can delete products
CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- B. ADMIN USERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can read admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.admin_users;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.admin_users;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Public access" ON public.admin_users;

-- Authenticated users can only read their own role record
-- No client insert, update, or delete permitted!
CREATE POLICY "Users can check their own admin status"
ON public.admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- C. ANALYTICS EVENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow inserting valid analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Only admins can read analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Admins can read analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.analytics_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.analytics_events;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.analytics_events;
DROP POLICY IF EXISTS "Public can view analytics" ON public.analytics_events;

-- Enforce strict event types and prevent user_id impersonation:
-- - Anonymous visitors: user_id must be NULL.
-- - Authenticated users: user_id must be NULL or match their own auth.uid().
CREATE POLICY "Allow inserting valid analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
    event_type IN ('site_visit', 'page_view', 'product_view', 'add_to_cart', 'sign_up', 'login')
    AND (
        (auth.uid() IS NULL AND user_id IS NULL)
        OR
        (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
    )
);

-- Only verified administrators can read analytics records
CREATE POLICY "Only admins can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- D. DEMO ORDERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Visitors can create demo orders" ON public.demo_orders;
DROP POLICY IF EXISTS "Only admins can view demo orders" ON public.demo_orders;
DROP POLICY IF EXISTS "Admins can view demo orders" ON public.demo_orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.demo_orders;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.demo_orders;
DROP POLICY IF EXISTS "Public can view demo orders" ON public.demo_orders;

-- Visitors can insert demo test orders with valid essential fields
CREATE POLICY "Visitors can create demo orders"
ON public.demo_orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
    is_demo = true
    AND customer_name IS NOT NULL AND length(trim(customer_name)) > 0
    AND customer_phone IS NOT NULL AND length(trim(customer_phone)) > 0
    AND shipping_address IS NOT NULL AND length(trim(shipping_address)) > 0
    AND city IS NOT NULL AND length(trim(city)) > 0
    AND total_amount >= 0
);

-- Only verified administrators can view demo orders
CREATE POLICY "Only admins can view demo orders"
ON public.demo_orders
FOR SELECT
TO authenticated
USING (public.is_admin());

COMMIT;

-- ==============================================================================
-- 4. POSTGREST SCHEMA CACHE RELOAD
-- ==============================================================================
-- Instructs PostgREST to reload its schema cache immediately so that
-- public.is_admin() and updated table grants are recognized without 404 errors.
NOTIFY pgrst, 'reload schema';
