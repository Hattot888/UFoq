# HORIZON Contemporary Art Gallery
### A complete art e-commerce platform with a real behavioral analytics system

A professional platform for selling and collecting original fine-art paintings. It is built with standard web technologies (HTML5 / CSS3 / Vanilla ES Modules), a PostgreSQL database, cloud authentication through Supabase, and a measured first-party behavioral telemetry engine for the owner—with no fake or simulated analytics figures.

---

## Table of Contents
1. [Project Overview and Purpose](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Opening the Project in VS Code](#4-opening-the-project-in-vs-code)
5. [Running Locally with Live Server](#5-running-locally-with-live-server)
6. [Creating a Free Supabase Project](#6-creating-a-supabase-project)
7. [Running `schema.sql` in Supabase](#7-running-the-database-schema-schemasql)
8. [Adding Sample Paintings with `seed.sql`](#8-adding-sample-paintings-with-seedsql)
9. [Configuring Supabase in `js/config.js`](#9-configuring-supabase-in-jsconfigjs)
10. [Setting Up Supabase Auth](#10-setting-up-supabase-auth)
11. [Authorizing the First Admin](#11-authorizing-the-first-admin)
12. [Security Policies and Row Level Security (RLS)](#12-security-policies-and-row-level-security-rls)
13. [Behavioral Event Tracking](#13-behavioral-event-tracking)
14. [KPI Calculation and the Analytics Dashboard](#14-kpi-calculation-and-the-analytics-dashboard)
15. [Verifying Event Collection](#15-verifying-event-collection)
16. [Preparing for Static Hosting](#16-preparing-for-static-hosting)
17. [Deploying to Cloudflare Pages](#17-deploying-to-cloudflare-pages)
18. [Known Technical Limitations](#18-known-technical-limitations)
19. [Security and Privacy Considerations](#19-security-and-privacy-considerations)
20. [Commercial Launch Checklist](#20-commercial-launch-checklist)

---

### 1. Project Overview

A complete digital gallery for fine art and contemporary artwork. It provides:
- A browsable art catalog with a contemporary gallery aesthetic.
- Instant search, category filtering, and sorting by price or popularity based on real view and interaction analytics.
- A dedicated detail page for each painting, using a stable reference ID (`product.html?id=UUID`).
- An interactive shopping cart stored in the browser, with prices recalculated from trusted data to prevent tampering.
- A documented demonstration checkout flow.
- A complete user account system powered by Supabase Auth.
- A private owner/admin dashboard protected by double verification. It displays real visitor activity, including visit metrics, unique visitors, artwork views, cart additions, a conversion funnel, and an interactive chart.

### 2. Technology Stack

- **Frontend:** Semantic HTML5 and vanilla CSS3; mobile-first responsive design, the Cairo font from Google Fonts, and native Arabic RTL layout.
- **Application logic:** JavaScript ES Modules, without large frameworks such as React or Vue.
- **Database and storage:** Supabase PostgreSQL with Row Level Security (RLS).
- **Authentication:** Supabase Auth (email and password).
- **External library:** `@supabase/supabase-js@2`, imported through a standard CDN-based ESM import.

### 3. Project Structure

```text
mohsen/
├── index.html              # Home page and art catalog
├── product.html            # Artwork details (?id=UUID)
├── cart.html               # Interactive cart and totals
├── checkout.html           # Demonstration checkout flow
├── login.html              # User and admin sign-in
├── signup.html             # New collector registration
├── admin.html              # Admin dashboard and live analytics
│
├── css/
│   ├── style.css           # Store design system, colors, and typography
│   └── admin.css           # Dashboard, cards, and chart styles
│
├── js/
│   ├── config.js           # Store settings and Supabase connection values
│   ├── supabase.js         # Supabase client and admin verification functions
│   ├── common.js           # Formatting utilities, notifications, and shared cart
│   ├── analytics.js        # Behavioral event tracking engine (telemetry)
│   ├── storefront.js       # Home page, filtering, and sorting logic
│   ├── product.js          # Artwork details and view tracking
│   ├── cart.js             # Cart logic and database-based price calculation
│   ├── checkout.js         # Demonstration order flow and persistence
│   ├── auth.js             # Sign-in and account logic
│   ├── admin.js            # Main admin dashboard module
│   ├── admin-products.js   # Artwork management (add, edit, delete, hide)
│   └── admin-analytics.js  # Real analytics aggregation and funnel chart
│
├── supabase/
│   ├── schema.sql          # Complete schema: tables, constraints, indexes, and RLS
│   └── seed.sql            # Sample artwork catalog
│
├── .gitignore              # Excludes temporary and system files
└── README.md               # Full documentation and setup guide
```

### 4. Opening the Project in VS Code

1. Open Visual Studio Code.
2. Select **File -> Open Folder...** (or press `Ctrl + K`, then `Ctrl + O`).
3. Select the project folder, for example `E:\mohsen`.

### 5. Running Locally with Live Server

Because the project uses modern JavaScript modules (`type="module"`), it must be served through a local HTTP server to avoid restrictions associated with opening files directly through `file://`:

1. In the VS Code Extensions marketplace, install **Live Server** by Ritwick Dey.
2. Right-click `index.html`.
3. Select **Open with Live Server**.
4. The browser should open at `http://127.0.0.1:5500/index.html`.

> **Important:** If Supabase has not been connected yet, the storefront will still run in **demo preview mode** using its built-in catalog, and a small notice will explain how to connect Supabase.

### 6. Creating a Supabase Project

1. Visit [supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New project**.
3. Choose a project name, such as `horizon-art-gallery`.
4. Set a strong database password and store it securely.
5. Choose a nearby region, such as Frankfurt or London, then click **Create new project**.

### 7. Running the Database Schema (`schema.sql`)

1. In the Supabase dashboard, open **SQL Editor** from the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` in the project and copy its entire contents.
4. Paste the SQL into the Supabase editor and click **Run** (or press `Ctrl + Enter`).
5. A success message should appear, such as `Success. No rows returned`.
6. The following tables will be created: `products`, `analytics_events`, `admin_users`, and `demo_orders`. Row Level Security will be enabled, and the schema's policies and indexes will be applied.

### 8. Adding Sample Paintings with `seed.sql`

1. In the Supabase SQL Editor, open a new query.
2. Copy the complete contents of `supabase/seed.sql`.
3. Paste the SQL into the editor and click **Run**.
4. Eight contemporary paintings will be added with their details, prices, and dimensions.

> **Note:** `seed.sql` only populates the artwork catalog. It does not generate fake analytics events, keeping the analytics figures genuine.

### 9. Configuring Supabase in `js/config.js`

1. In Supabase, go to **Project Settings** (the gear icon near the lower-left corner) -> **API**.
2. Find these values:
   - **Project URL:** looks similar to `https://abcdefghijkl.supabase.co`.
   - **Project API Keys:** copy the key labeled `anon` / `public`, which may start with `eyJ...`.
3. Open `js/config.js` in VS Code and enter the values:

```javascript
export const CONFIG = {
  // ...
  SUPABASE_URL: 'https://your-project-id.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  // ...
};
```

4. Save the file (`Ctrl + S`).

> **Critical security warning:** Never place a `service_role` key or database password in frontend files. Only a public `anon` key (or the equivalent publishable key) is intended for browser use, and access must be protected by properly configured RLS policies.

### 10. Setting Up Supabase Auth

1. In the Supabase dashboard, open **Authentication** -> **Providers**.
2. Make sure the **Email** provider is enabled.
3. **Optional for rapid development:** under **Authentication** -> **URL Configuration** or **Email Templates**, you can disable `Confirm email` if you want users to sign in without waiting for an email confirmation.

### 11. Authorizing the First Admin

To prevent unauthorized users from accessing the admin dashboard, users cannot automatically grant themselves admin privileges. The owner must perform this one-time setup:

1. Open the storefront registration page: `http://127.0.0.1:5500/signup.html`.
2. Create an account using your email address and a personal password.
3. In the Supabase dashboard, open **Authentication** -> **Users**.
4. Find your new account and copy its unique identifier, called the **User UID** (a UUID string such as `c2b4d9a1-8765-4321-abcd-123456789abc`).
5. Open **SQL Editor** in Supabase and run the following statement, replacing the placeholder with your actual user ID:

```sql
INSERT INTO public.admin_users (user_id, role)
VALUES ('PASTE_THE_COPIED_USER_ID_HERE', 'admin')
ON CONFLICT (user_id) DO NOTHING;
```

6. Open `admin.html` in your browser and sign in. The admin dashboard should then be available with its management and analytics features.

### 12. Security Policies and Row Level Security (RLS)

Row Level Security is applied at the PostgreSQL level:

- **`products` table:**
  - Public users can read active products only (`is_active = true`).
  - Only users listed as admins in `admin_users` can add, edit, or delete products.
- **`analytics_events` table:**
  - Anonymous and authenticated visitors can insert only the six permitted event types. Spoofing another user's ID is prohibited by policy.
  - Reading and querying analytics is restricted to authorized admins.
  - Client-side updates and deletes are prohibited to preserve the integrity of historical analytics records.
- **`admin_users` table:**
  - Regular users cannot add themselves as admins. Admin records must be added through the cloud SQL Editor or another appropriately privileged server-side process.

### 13. Behavioral Event Tracking

The `js/analytics.js` module implements a standardized, restricted event-tracking policy:

- **Permitted events only:**
  1. `site_visit`: recorded once per browsing session (`sessionStorage`) when a visitor enters the public storefront.
  2. `page_view`: recorded when each page is loaded.
  3. `product_view`: recorded when an artwork details page is opened and matched to its real `product_id`.
  4. `add_to_cart`: recorded only after an item is successfully added to the cart.
  5. `sign_up`: recorded after account creation succeeds through Supabase Auth.
  6. `login`: recorded after sign-in succeeds.
- **Admin exclusion:** Admin browsing activity on `admin.html` is automatically excluded from public visitor analytics.
- **Visitor ID:** A random first-party identifier (RFC 4122 version 4 UUID) stored in `localStorage`, with no invasive device fingerprinting or IP-address collection.
- **Session ID:** A temporary identifier stored in `sessionStorage`, which expires when the tab is closed.
- **Non-blocking execution:** Events are sent asynchronously in the background, without interrupting or blocking the visitor's shopping experience.

### 14. KPI Calculation and the Analytics Dashboard

All metrics are calculated from records stored in `analytics_events`:

- **Site visits:** Total records where `event_type = 'site_visit'`.
- **Distinct visitors:** Number of unique `visitor_id` values.
- **Artwork views:** Total `product_view` events.
- **Cart additions:** Total `add_to_cart` events.
- **Collectors who added items to the cart:** Number of unique visitor IDs that generated an `add_to_cart` event.
- **Conversion rate:** `(artwork additions to cart / artwork detail-page views) × 100`. A “Not enough data” message is displayed when there are no views, avoiding division by zero.
- **Conversion funnel:** Tracks the sequence: visit (100%) -> percentage who browsed artworks -> percentage who added items to the cart -> percentage who registered or signed in.

### 15. Verifying Event Collection

To verify that events are being recorded in the database in real time:

1. Open `index.html` in an incognito/private browser window.
2. Open Developer Tools (`F12`) -> **Console**. You should see messages such as:
   - `[Analytics 📊] Event: site_visit`
   - `[Analytics 📊] Event: page_view`
3. Click an artwork to open its details. The following event should appear:
   - `[Analytics 📊] Event: product_view`
4. Click **Add to cart**. The following event should appear:
   - `[Analytics 📊] Event: add_to_cart`
5. In Supabase, open **Table Editor** -> `analytics_events`. You should see the recorded rows with UTC timestamps, visitor IDs, and artwork IDs.
6. Open `admin.html` and click **Refresh ⟳**. The metrics, charts, and table should update.

### 16. Preparing for Static Hosting

The project is a purely static site and does not require a custom server or Node.js:

- All links and file imports use relative paths (`./js/...`).
- Database access and authentication are handled directly from the browser through the Supabase REST APIs.

### 17. Deploying to Cloudflare Pages

To publish the site publicly for free:

1. Push the project to a GitHub repository, or upload the project folder through the Cloudflare dashboard.
2. Open the [Cloudflare Dashboard](https://dash.cloudflare.com).
3. Select **Workers & Pages** -> **Create application** -> **Pages**.
4. Connect your GitHub account and select the repository for the project.
5. Under build settings:
   - **Framework preset:** `None`.
   - **Build command:** leave blank.
   - **Build output directory:** `.` (the project root).
6. Click **Save and Deploy**.
7. The site will be available at a public URL, with a global content-delivery network and an automatically provisioned SSL certificate.

### 18. Known Technical Limitations

- **Visitor identity:** The browser-stored visitor ID is an approximation. If visitors clear browser storage or use a different browser, a new ID will be generated.
- **Ad blockers:** Some strict browser extensions may block analytics requests or connections to cloud domains.
- **Image storage:** The current version uses direct image URLs rather than a more complex image-upload system to avoid additional cost.

### 19. Security and Privacy Considerations

- Passwords, payment-card details, and phone numbers are not recorded or sent to the analytics table.
- The frontend respects the browser's `Do-Not-Track` preference when enabled by the visitor.
- RLS policies protect customer data and analytics records from unauthorized access.

### 20. Commercial Launch Checklist

Before launching the store for real commercial transactions, the following are required:

1. Integrate an approved electronic payment gateway (such as Paymob, Fawry, or Stripe) and replace the demonstration `checkout.html` flow with an official, secure integration.
2. Add documented terms and conditions and a returns policy that comply with applicable local commercial regulations.
3. Configure a custom domain (such as `horizon-gallery.com`) with SSL security.
4. Implement request rate limits through Supabase Edge Functions to protect the store against request flooding and abuse.

---

**HORIZON Contemporary Art Gallery** — A complete and transparent platform, built with care and a focus on quality.
