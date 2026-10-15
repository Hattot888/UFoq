-- ==============================================================================
-- HORIZON CONTEMPORARY ART GALLERY (معرض أفق للفنون المعاصرة)
-- Database Schema for Supabase PostgreSQL
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRODUCTS TABLE
-- Stores the gallery's paintings and artworks
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    currency TEXT NOT NULL DEFAULT 'EGP',
    image_url TEXT,
    category TEXT NOT NULL DEFAULT 'تجريدي',
    artist TEXT NOT NULL DEFAULT 'فنان معاصر',
    dimensions TEXT,
    medium TEXT,
    stock_quantity INTEGER NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for searching, filtering, and ordering products
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- 3. ADMIN USERS TABLE
-- Secure administrative whitelist table
-- Normal users CANNOT insert into this table.
-- The store owner must bootstrap their Auth user ID here.
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for authorization checks
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);

-- 4. ANALYTICS EVENTS TABLE
-- High-fidelity behavioral telemetry table
-- Controlled event types: site_visit, page_view, product_view, add_to_cart, sign_up, login
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (
        event_type IN ('site_visit', 'page_view', 'product_view', 'add_to_cart', 'sign_up', 'login')
    ),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    visitor_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page_path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Targeted indexes for performant aggregation queries
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_product_id ON public.analytics_events(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_id ON public.analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics_events(user_id) WHERE user_id IS NOT NULL;

-- 5. DEMO TEST ORDERS TABLE
-- Clearly separated from analytics to store demonstration checkout submissions
CREATE TABLE IF NOT EXISTS public.demo_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    city TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EGP',
    payment_method TEXT NOT NULL DEFAULT 'demo_cod',
    is_demo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for demo orders
CREATE INDEX IF NOT EXISTS idx_demo_orders_created_at ON public.demo_orders(created_at DESC);

-- ==============================================================================
-- 6. SECURITY FUNCTIONS & HELPERS
-- ==============================================================================

-- Security Definer function to check admin status
-- Executes with owner privileges to prevent permission errors in RLS evaluation
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Trigger to update updated_at timestamp on products
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 7. TABLE-LEVEL PRIVILEGES (GRANTs)
-- ==============================================================================

-- Products table
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- Analytics Events table
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;

-- Demo Orders table
GRANT INSERT ON public.demo_orders TO anon, authenticated;
GRANT SELECT ON public.demo_orders TO authenticated;

-- Admin Users table (Only authenticated users, NEVER anon)
REVOKE ALL ON public.admin_users FROM anon;
GRANT SELECT ON public.admin_users TO authenticated;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_orders ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. PRODUCTS POLICIES
-- ------------------------------------------------------------------------------

-- Public visitors and authenticated users can read active products
CREATE POLICY "Public visitors can read active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Verified administrators can view all products (including inactive)
CREATE POLICY "Admins can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Only verified admins can insert products
CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Only verified admins can update products
CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Only verified admins can delete products
CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- B. ADMIN USERS POLICIES
-- ------------------------------------------------------------------------------

-- Users can only read their own admin record to verify authorization
CREATE POLICY "Users can check their own admin status"
ON public.admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- NO public INSERT, UPDATE, or DELETE on admin_users!
-- Only service_role or manual database bootstrap via Supabase SQL editor can grant admin role.

-- ------------------------------------------------------------------------------
-- C. ANALYTICS EVENTS POLICIES
-- ------------------------------------------------------------------------------

-- Anyone (anonymous visitors and authenticated users) can insert valid analytics events
-- Strictly enforces allowed event_type and ensures authenticated users cannot forge another user's ID
CREATE POLICY "Allow inserting valid analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
    event_type IN ('site_visit', 'page_view', 'product_view', 'add_to_cart', 'sign_up', 'login')
    AND (user_id IS NULL OR user_id = auth.uid())
);

-- ONLY authorized admins can read analytics events
CREATE POLICY "Only admins can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- D. DEMO ORDERS POLICIES
-- ------------------------------------------------------------------------------

-- Visitors can insert demo test orders
CREATE POLICY "Visitors can create demo orders"
ON public.demo_orders
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can view demo orders
CREATE POLICY "Only admins can view demo orders"
ON public.demo_orders
FOR SELECT
TO authenticated
USING (public.is_admin());


DROP TRIGGER IF EXISTS trigger_products_updated_at ON public.products;
CREATE TRIGGER trigger_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 8. SECURE AGGREGATION RPC FOR PRODUCT POPULARITY
-- Allows public storefront to sort by actual views without exposing raw private analytics records
CREATE OR REPLACE FUNCTION public.get_product_popularity()
RETURNS TABLE (
    product_id UUID,
    view_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        product_id,
        COUNT(*)::BIGINT AS view_count
    FROM public.analytics_events
    WHERE event_type = 'product_view' AND product_id IS NOT NULL
    GROUP BY product_id;
$$;

-- Grant execution to public anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_product_popularity() TO anon, authenticated;

