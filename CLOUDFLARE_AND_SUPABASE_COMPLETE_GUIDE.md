# COMPLETE GUIDE: CLOUDFLARE & SUPABASE SETUP, USAGE, AND BILLING MANUAL
### For VRSEC Incubation Centre Management System (Incubation-CMS)

This comprehensive manual contains **everything** required to set up, configure, use, link, and pay for **Cloudflare** and **Supabase** for the VRSEC Incubation Centre website.

---

## TABLE OF CONTENTS
1. [Overview & Architecture](#1-overview--architecture)
2. [Cloudflare Complete Guide](#2-cloudflare-complete-guide)
   - [2.1 Creating a Cloudflare Account](#21-creating-a-cloudflare-account)
   - [2.2 Adding Payment Methods & Fee Structure](#22-adding-payment-methods--fee-structure)
   - [2.3 Cloudflare R2 (Image Storage) Setup & Pricing](#23-cloudflare-r2-image-storage-setup--pricing)
   - [2.4 Cloudflare Pages (Website Hosting & Functions) Setup](#24-cloudflare-pages-website-hosting--functions-setup)
   - [2.5 Linking R2 Bucket to Cloudflare Pages](#25-linking-r2-bucket-to-cloudflare-pages)
   - [2.6 Custom Domain Configuration (vrsec.ac.in)](#26-custom-domain-configuration-vrsecacin)
3. [Supabase Complete Guide](#3-supabase-complete-guide)
   - [3.1 Creating a Supabase Account & Project](#31-creating-a-supabase-account--project)
   - [3.2 Adding Payment Methods & Plans](#32-adding-payment-methods--plans)
   - [3.3 Free Tier Limits vs Paid Pro Plan](#33-free-tier-limits-vs-paid-pro-plan)
   - [3.4 Setting Spend Caps to Prevent Unexpected Charges](#34-setting-spend-caps-to-prevent-unexpected-charges)
   - [3.5 Finding Supabase API Credentials (URL & Anon Key)](#35-finding-supabase-api-credentials-url--anon-key)
   - [3.6 Setting Up Database Schema & Migrations](#36-setting-up-database-schema--migrations)
   - [3.7 Configuring Supabase Authentication](#37-configuring-supabase-authentication)
4. [Connecting Cloudflare & Supabase Together](#4-connecting-cloudflare--supabase-together)
   - [4.1 Required Environment Variables](#41-required-environment-variables)
   - [4.2 Local Development vs Production Settings](#42-local-development-vs-production-settings)
5. [Cost Estimation & Optimization Summary](#5-cost-estimation--optimization-summary)
6. [Emergency & Troubleshooting Guide](#6-emergency--troubleshooting-guide)

---

## 1. OVERVIEW & ARCHITECTURE

The VRSEC Incubation Centre Management System uses a high-performance, cost-effective hybrid cloud architecture designed to keep hosting fees at or near **₹0 to ₹2,100 per month** maximum:

```
+-----------------------------------------------------------------------------------+
|                                 USER BROWSER                                      |
+-----------------------------------------------------------------------------------+
                                   |
         +-------------------------+-------------------------+
         | (Static Assets & API)                             | (Direct Auth / Realtime)
         v                                                   v
+------------------------------------+           +----------------------------------+
|          CLOUDFLARE                |           |            SUPABASE              |
|                                    |           |                                  |
| 1. Cloudflare Pages:               |           | 1. PostgreSQL Database:          |
|    - React + Vite Web App Host     |           |    - Students, Components, Logs  |
|    - Free CDN & SSL Certificate    |           |    - Zero binary blobs in DB     |
|                                    |           |    - Only image keys (r2:key)    |
| 2. Cloudflare Pages Functions:     |           |                                  |
|    - Serverless Backend (/api)     |           | 2. Supabase Auth:                |
|    - Token validation & IDOR check |           |    - JWT Sessions & User Roles   |
|                                    |           |                                  |
| 3. Cloudflare R2 Storage:          |           | 3. Row-Level Security (RLS):     |
|    - Component location photos     |           |    - Fine-grained data access    |
|    - Student face embeddings/photos|           +----------------------------------+
|    - Project & showcase photos     |
+------------------------------------+
```

---

## 2. CLOUDFLARE COMPLETE GUIDE

### 2.1 Creating a Cloudflare Account
1. Open your web browser and go to: **[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**.
2. Enter your email (preferably the official incubation email, e.g., `incubation@vrsiddhartha.ac.in` or admin personal email).
3. Create a strong password (minimum 8 characters, letters, numbers, special characters).
4. Click **Create Account**.
5. Check your email inbox for a verification email from Cloudflare and click the **Verify email address** link.
6. Once verified, you will be in the **Cloudflare Dashboard**.

---

### 2.2 Adding Payment Methods & Fee Structure

#### Is Cloudflare Free?
- **Cloudflare Pages**: **100% FREE** (unlimited bandwidth, free SSL, 500 site builds/month, 100,000 serverless function requests/day).
- **Cloudflare R2**: Free tier includes **10 GB storage free every month**, 1,000,000 write operations/month free, and 10,000,000 read operations/month free. **Bandwidth egress is ₹0 (100% free forever)**.
- **Important**: Cloudflare requires a valid credit/debit card on file to **activate** the R2 service, even if your usage stays within the free tier.

#### How to Add a Card in Cloudflare:
1. Log in to **[https://dash.cloudflare.com/](https://dash.cloudflare.com/)**.
2. In the top right corner, click your profile icon $\rightarrow$ **Manage Account** (or select your account).
3. In the left sidebar, click **Billing** $\rightarrow$ **Payment info**.
4. Click **Add payment method**.
5. Choose **Credit Card** or **PayPal**:
   - Supported cards: Visa, Mastercard, American Express, Discover.
   - **Indian Banks Requirement**: Ensure **International Transactions** and **Online / E-commerce transactions** are turned **ON** in your bank's mobile banking app (SBI, HDFC, ICICI, Axis, etc.), as Cloudflare bills from the USA.
6. Enter the card number, expiration date, CVV, and billing address.
7. Click **Save**. Cloudflare may place a temporary verification hold ($0 or $1) which is automatically refunded.

#### Setting Billing Email & Invoices:
- Under **Billing** $\rightarrow$ **Preferences**, enter the college accounting or lab email where monthly invoices/receipts will be sent automatically.

---

### 2.3 Cloudflare R2 (Image Storage) Setup & Pricing

#### R2 Pricing Breakdown:
| Resource | Free Tier (Every Month) | Cost Above Free Tier |
| :--- | :--- | :--- |
| **Storage** | 10 GB Free | $0.015 / GB-month (~₹1.25 per GB) |
| **Class A (Uploads / Writes)** | 1,000,000 operations | $4.50 / 1,000,000 operations |
| **Class B (Reads / Views)** | 10,000,000 operations | $0.36 / 1,000,000 operations |
| **Data Egress (Bandwidth)** | **UNLIMITED FREE ($0.00)** | **$0.00 (Zero bandwidth fees)** |

*Because our app caches images with HTTP ETags and browser caching, 10 GB and 10 million reads can easily cover all incubation lab usage for free or less than ₹50/month.*

#### Step-by-Step R2 Bucket Creation:
1. In Cloudflare Dashboard left menu, click **R2**.
2. If this is your first time, click **Subscribe to R2** (confirming your payment method).
3. Click **Create bucket**.
4. Set the **Bucket name** to:
   ```
   vrsec-incubation-cms-bucket
   ```
5. **Location hint**: Select **Automatic** (or Asia-Pacific / India if prompted).
6. Click **Create Bucket**.
7. **DO NOT** make the bucket public. Keep it **Private**. Our secure Cloudflare Pages Function (`/api/image/[[key]]`) proxies all images and enforces student roll-number privacy automatically.

---

### 2.4 Cloudflare Pages (Website Hosting & Functions) Setup

#### Method A: Connecting Directly via GitHub (Recommended for Auto-Deployments)
1. In the Cloudflare Dashboard left menu, click **Workers & Pages**.
2. Click **Create application** $\rightarrow$ select the **Pages** tab.
3. Click **Connect to Git**.
4. Authorize your GitHub account and select your repository: `antigravity` (or your repository name).
5. Configure the Build Settings:
   - **Project name**: `vrsec-incubation-cms`
   - **Production branch**: `main`
   - **Framework preset**: `Vite`
   - **Root directory**: Leave blank or set to `/`
   - **Build command**:
     ```bash
     npm run build --prefix frontend
     ```
   - **Build output directory**:
     ```
     frontend/dist
     ```
6. Click **Save and Deploy**. Cloudflare will build the frontend and deploy the serverless functions located in `/functions/`.

#### Method B: Manual Deployment via Wrangler CLI (From Command Line)
If you prefer deploying directly from your laptop without connecting GitHub:
1. Open PowerShell in `c:\Users\Asus\Desktop\antigravity`.
2. Run:
   ```powershell
   npm run build --prefix frontend
   npx wrangler pages deploy frontend/dist --project-name vrsec-incubation-cms
   ```

---

### 2.5 Linking R2 Bucket to Cloudflare Pages

This step connects the R2 bucket directly to the Pages Functions backend so `/api/upload` and `/api/image` can write and read images:

1. In Cloudflare Dashboard, go to **Workers & Pages**.
2. Click your project: **`vrsec-incubation-cms`**.
3. Click the **Settings** tab at the top.
4. In the left sub-menu, click **Functions**.
5. Scroll down to the **R2 bucket bindings** section.
6. Click **Add binding**:
   - **Variable name**: 
     ```
     CMS_BUCKET
     ```
     *(Must be uppercase and exactly `CMS_BUCKET`)*
   - **R2 bucket**: Select `vrsec-incubation-cms-bucket`.
7. Choose **Both Production and Preview**.
8. Click **Save**.

---

### 2.6 Custom Domain Configuration (vrsec.ac.in)

To make your website open at `incubation.vrsec.ac.in` or `incubation-cms.vrsiddhartha.ac.in`:

1. In your Pages project (`vrsec-incubation-cms`), click the **Custom domains** tab.
2. Click **Set up a custom domain**.
3. Enter your domain: `incubation.vrsec.ac.in`.
4. Click **Continue**.
5. Cloudflare will give you a **CNAME record**:
   - **Type**: `CNAME`
   - **Name**: `incubation`
   - **Content / Value**: `vrsec-incubation-cms.pages.dev`
6. Send this CNAME record to the college IT administrator or enter it in your domain DNS manager.
7. Cloudflare will automatically issue and renew a free **SSL/TLS HTTPS certificate**.

---

## 3. SUPABASE COMPLETE GUIDE

### 3.1 Creating a Supabase Account & Project
1. Open your web browser and go to: **[https://supabase.com/](https://supabase.com/)**.
2. Click **Start your project** or **Sign In**.
3. Sign in using your **GitHub account** (recommended) or enter your email and password.
4. Click **New Project**.
5. Select or create your Organization (e.g., `VRSEC-Incubation`).
6. Configure the project:
   - **Name**: `VRSEC Incubation CMS`
   - **Database Password**: Choose a strong password and **write it down** (e.g., save in a secure password manager).
   - **Region**: Choose **South Asia (Mumbai) - ap-south-1** (Crucial: Mumbai provides <25ms ping latency for students in Andhra Pradesh / Vijayawada).
   - **Pricing Plan**: Choose **Free** (or Pro if funded).
7. Click **Create new project**. Supabase will take 1-2 minutes to provision the PostgreSQL database.

---

### 3.2 Adding Payment Methods & Plans

#### How to Add a Card in Supabase:
1. In the Supabase Dashboard, click the **Settings** (gear icon) in the bottom left menu.
2. Under Organization, click **Billing**.
3. Click **Payment Methods** $\rightarrow$ **Add Payment Method**.
4. Enter your credit/debit card details (Visa/Mastercard with international payments enabled).
5. Click **Save**.

---

### 3.3 Free Tier Limits vs Paid Pro Plan

| Feature | Free Tier | Pro Plan ($25 / month ~ ₹2,100) |
| :--- | :--- | :--- |
| **Monthly Cost** | **₹0.00** | **$25.00 / month (~₹2,100)** |
| **PostgreSQL Database Storage** | 500 MB (holds ~500,000 text records) | 8 GB included ($0.125/GB after) |
| **Monthly Active Users (Auth)** | 50,000 MAU | 100,000 MAU |
| **Project Pausing** | **Pauses after 7 days of zero activity** | **NEVER pauses. Always online 24/7** |
| **Automated Backups** | None (manual export only) | Daily automated backups (7-day retention) |
| **Email Auth Rate Limits** | 30 emails/hour | Built-in SMTP or custom provider |

#### Important Note on Free Tier "Pausing":
- On Supabase's **Free Plan**, if no student or admin opens the website or makes a query for **7 consecutive days**, Supabase temporarily pauses the database to save server costs.
- When someone visits, clicking "Restore" in the dashboard unpauses it in 1 minute.
- **For Production College Deployment**: Upgrading to the **Pro Plan ($25/mo)** ensures the database never pauses and runs 24/7 uninterrupted throughout the academic semester.

---

### 3.4 Setting Spend Caps to Prevent Unexpected Charges

If you subscribe to the Supabase Pro Plan, always turn **ON** the Spend Cap:
1. Go to Supabase Dashboard $\rightarrow$ **Organization Settings** $\rightarrow$ **Billing**.
2. Click **Subscription**.
3. Locate **Cost Control / Spend Cap**.
4. Toggle **Spend Cap ON**.
   - With Spend Cap ON, your bill will **never exceed $25/month**. Supabase will simply stop extra usage rather than billing overages.

---

### 3.5 Finding Supabase API Credentials (URL & Anon Key)

You need two values to link your frontend and Cloudflare Functions to Supabase:

1. In Supabase Dashboard, click the **Settings** (gear icon) at the bottom of the left sidebar.
2. Click **API** under the Configuration section.
3. Locate the **Project URL**:
   - Looks like: `https://abcdefghijklm.supabase.co`
4. Locate the **Project API Keys**:
   - Find the key labeled **`anon` `public`**.
   - Looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI...`
5. Copy both values. Keep them ready for the environment variables step.

---

### 3.6 Setting Up Database Schema & Migrations

The database tables, relations, and security policies are already written in your project's `database/supabase/migrations/` folder.

To apply them to your Supabase project:
1. In Supabase Dashboard, click the **SQL Editor** tab (terminal icon with `>_`) in the left menu.
2. Click **New Query**.
3. Open `database/supabase/migrations/consolidated_migrations_001_to_005.sql` from your laptop in a text editor (e.g., VS Code or Notepad).
4. Copy the entire SQL content, paste it into the Supabase SQL Editor, and click **Run**.
5. Repeat for any subsequent migration files (e.g., `008_final_seven_category_inventory.sql`, `011_unified_auto_attendance.sql`).
6. Click **Table Editor** on the left to verify that tables like `components`, `users`, `daily_attendance`, `visits`, and `transactions` are created.

---

### 3.7 Configuring Supabase Authentication

Our application allows students to sign in using their official College Roll Numbers.

1. In Supabase Dashboard, click **Authentication** (person icon) in the left menu.
2. Click **Providers** $\rightarrow$ **Email**.
3. Ensure **Enable Email provider** is turned **ON**.
4. **Turn OFF** **Confirm email**:
   - Because students register with generated internal emails (e.g., `238W1A0477@student.incubation.local`), turning off email confirmation allows immediate registration and login at the lab entrance station without waiting for confirmation links.
5. Click **Save**.

---

## 4. CONNECTING CLOUDFLARE & SUPABASE TOGETHER

### 4.1 Required Environment Variables

You need to set these environment variables in **Cloudflare Pages**:

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase Project URL for React frontend | `https://your-project.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Public Key for React frontend | `eyJhbGciOi...` |
| `SUPABASE_URL` | Supabase Project URL for Pages Functions | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Anon Key for Pages Functions token check | `eyJhbGciOi...` |

#### How to Add Them in Cloudflare Pages:
1. Go to Cloudflare Dashboard $\rightarrow$ **Workers & Pages**.
2. Click your project: `vrsec-incubation-cms`.
3. Go to **Settings** $\rightarrow$ **Environment variables**.
4. Under **Production**, click **Add variables**.
5. Enter all 4 variables listed in the table above.
6. Click **Save**.

---

### 4.2 Local Development vs Production Settings

#### For Local Development on Your Laptop:
Create a file named `.env.local` inside `c:\Users\Asus\Desktop\antigravity\frontend\`:
```ini
# frontend/.env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

When running `npm run dev` locally:
- If Supabase is connected, live authentication and database operations work directly.
- If offline, `database.js` automatically uses IndexedDB and in-memory mock data without crashing.
- If R2 is not bound locally, `storageService.js` creates offline image previews so development is never blocked.

---

## 5. COST ESTIMATION & OPTIMIZATION SUMMARY

### Monthly Cost Scenarios:

| Scenario | Cloudflare Cost | Supabase Cost | Total Estimated Cost |
| :--- | :--- | :--- | :--- |
| **Development & Testing** | ₹0.00 (Free Tier) | ₹0.00 (Free Tier) | **₹0 / month** |
| **Small Lab Usage (<500 students)** | ₹0.00 (Free Tier) | ₹0.00 (Free Tier)* | **₹0 / month** |
| **Full Institute Production (24/7)** | ₹0.00 to ₹50 / month | $25 / month (~₹2,100) | **~₹2,100 to ₹2,150 / month** |

*\*Note: Free tier pauses after 7 days of inactivity; Pro plan ($25) eliminates pausing.*

### How Costs Are Minimized:
1. **Zero Database Bloat**: Images are stored in Cloudflare R2, not Supabase Postgres. 10,000 photos stored in Supabase would exhaust the database limit and cost expensive database upgrades; on R2, 10,000 photos consume <2 GB, which is 100% within the free tier.
2. **Zero Egress Fees**: Unlike AWS S3 (which charges $0.09 per GB downloaded), Cloudflare R2 has **$0.00 egress bandwidth fees**.
3. **Aggressive Client Caching**: Images are served with HTTP `ETag` and `Cache-Control: private, max-age=86400`. When a student or staff views a component photo, subsequent loads return `304 Not Modified`, consuming zero bandwidth and zero storage operations.

---

## 6. EMERGENCY & TROUBLESHOOTING GUIDE

### Issue 1: "Card Declined / Failed to add Payment Method"
- **Cause**: Indian Reserve Bank of India (RBI) e-mandate regulations require international online transactions to be activated.
- **Fix**: Open your bank's app (SBI, HDFC, ICICI, etc.) $\rightarrow$ Cards $\rightarrow$ Manage Card Limits $\rightarrow$ Enable **International Transactions** and **Online E-commerce**.

### Issue 2: "R2 bucket binding CMS_BUCKET not found"
- **Cause**: The Pages Function is trying to access R2, but the binding name in Cloudflare Pages is missing or misspelled.
- **Fix**: Go to Cloudflare Dashboard $\rightarrow$ Pages $\rightarrow$ Settings $\rightarrow$ Functions $\rightarrow$ R2 Bucket Bindings. Ensure the variable name is exactly `CMS_BUCKET`.

### Issue 3: "Supabase project paused"
- **Cause**: On the Free plan, no queries were made for 7 consecutive days.
- **Fix**: Log in to [https://supabase.com/dashboard](https://supabase.com/dashboard), click your project, and click **Restore Project** (takes ~60 seconds to resume). To permanently prevent pausing, upgrade to Pro.

### Issue 4: "403 Forbidden when viewing face photo"
- **Cause**: The system's biometric IDOR protection prevents students from viewing other students' face photos.
- **Fix**: This is an intended security measure. Only the authenticated student can view their own photo, while Admin and Staff roles can view all lab photos for identity verification.

---

### Quick Access URL Reference

| Service | Portal / Dashboard URL |
| :--- | :--- |
| **Cloudflare Dashboard** | [https://dash.cloudflare.com/](https://dash.cloudflare.com/) |
| **Cloudflare Billing** | [https://dash.cloudflare.com/?to=/:account/billing](https://dash.cloudflare.com/?to=/:account/billing) |
| **Cloudflare Pages** | [https://dash.cloudflare.com/?to=/:account/workers-and-pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) |
| **Cloudflare R2** | [https://dash.cloudflare.com/?to=/:account/r2](https://dash.cloudflare.com/?to=/:account/r2) |
| **Supabase Dashboard** | [https://supabase.com/dashboard](https://supabase.com/dashboard) |
| **Supabase Billing** | [https://supabase.com/dashboard/org/_/billing](https://supabase.com/dashboard/org/_/billing) |
| **Supabase SQL Editor** | [https://supabase.com/dashboard/project/_/sql](https://supabase.com/dashboard/project/_/sql) |
