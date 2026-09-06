# INFORMIX BD — Service, Invoice & Money Receipt Management System

A production-ready, multi-user web application powered by **Supabase (PostgreSQL + Auth + RLS)** and designed with a **Minimal Luxury** aesthetic.

---

## Key Highlights & Features

1. **Supabase Cloud Backend**:
   - Replaces LocalStorage as the main database.
   - Real-time multi-device synchronization.
   - Robust PostgreSQL schema with Row Level Security (RLS) policies.
   - Deletion persistence (when records are deleted, they stay deleted; zero hardcoded demo re-seeding).

2. **Secure Authentication & Role-Based Access Control**:
   - Supabase Email & Password authentication.
   - Protected dashboard with animated backdrop blur on logged-out state.
   - **Super Admin** role with full control over user accounts (create, edit, disable/enable, delete, password reset).
   - **Staff / Normal User** role with operational permissions for invoices, receipts, and customers.

3. **Dynamic "Prepared By: [Logged-in User Name]"**:
   - The authenticated user's name is dynamically retrieved from their profile and stamped onto all generated Invoices and Money Receipts.
   - Company branding and user attribution remain strictly distinct.

4. **Fast Invoice Generator (Minimal Luxury)**:
   - Streamlined single-screen invoice creation.
   - Smart customer autocomplete search with instant inline creation for new clients.
   - Rapid item entry with dynamic rows and keyboard `[Enter]` shortcut on the rate input to spawn and focus the next line item.
   - Live automatic calculations: Subtotal, Discount, Tax / VAT %, Other Charges, Grand Total, Amount Paid, and Due Balance.
   - Amount in Words generator in formal Bengali Taka format.
   - Sequential, collision-free database invoice numbers (`INV-YYYY-000001`).

5. **Dedicated Service Money Receipt Generator**:
   - Tailored specifically for surveillance and security device maintenance (CCTV, DVR/NVR, IP Cameras).
   - Tracks Device Name, Model, Serial Number, Problem Description, and Work Performed.
   - Distinct receipt layout with customer acknowledgment statements and dual signature blocks.

6. **Dual Export Engines (Print & High-Fidelity PDF)**:
   - **Pixel-Perfect A4 Browser Print**: Dedicated print stylesheet (`css/print.css`) hiding all UI controls, navigation, and sidebar with strict page-break protection.
   - **Vector A4 PDF**: Client-side high-resolution PDF generation powered by `jsPDF` and `autoTable`.

7. **Centralized Company Settings & Assets**:
   - Manage Company Name, Tagline, Address, Phone, Email, Website, and Prefixes.
   - Bank details and mobile banking (bKash/Nagad) embedded into invoice payment boxes.
   - Replaceable logo upload via Supabase Storage.

---

## Database Setup Guide (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Open the `supabase-schema.sql` file from this project, copy its full content, paste it into the SQL Editor, and click **Run**.
4. The script will automatically:
   - Create tables: `profiles`, `business_settings`, `customers`, `invoices`, `invoice_items`, `money_receipts`, `receipt_items`, `activities`.
   - Configure Row Level Security (RLS) policies.
   - Create triggers for auto-profile creation on user signup (the first registered user is automatically assigned the **Super Admin** role).
   - Create sequential invoice and receipt numbering functions.
   - Create the `business-assets` storage bucket for logo uploads.

---

## Configuration & Local Setup

### 1. Connecting to Supabase
You can configure your Supabase credentials in either of two ways:
- **Via the Settings UI**: Navigate to `#settings`, scroll to the **Supabase Database Connection** section, enter your **Supabase URL** and **Anon Key**, and click **Update Supabase Credentials**.
- **In `js/supabase.js`**: Edit the `DEFAULT_CONFIG` object directly:
  ```javascript
  const DEFAULT_CONFIG = {
    url: 'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_PUBLIC_KEY',
  };
  ```

### 2. Running the Application
No build steps, Node.js, or complex bundling required! You can open `index.html` directly in any modern web browser or serve it using any HTTP server:
```bash
# Using Python
python -m http.server 8080

# Or using PHP
php -S localhost:8080

# Or using Live Server in VS Code
```

---

## Initial Super Admin Setup
1. Launch the application in your browser.
2. In the Login Screen, click **"First time setup? Create initial Super Admin account"**.
3. Enter your **Full Name**, **Admin Email**, and **Password**.
4. Click **Create Admin Account**. You are now logged in as the Super Admin.
5. As Super Admin, you can navigate to **User Management** (`#users` or `Ctrl+U`) to invite additional staff members.

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + 1` | Dashboard | Global |
| `Ctrl + 2` | Invoices (Fast Generator) | Global |
| `Ctrl + 3` | Money Receipts | Global |
| `Ctrl + 4` | Customers | Global |
| `Ctrl + 5` | Analytics | Global |
| `Ctrl + K` | Search Database | Global |
| `Ctrl + U` | User Management (Super Admin) | Global |
| `Ctrl + ,` | Settings | Global |
| `Ctrl + B` | Toggle Dark / Light Theme | Global |
| `Esc` | Close Any Active Modal | Global |
| `Enter` | Add and focus next line item | Invoice Items Table |

---

## File Structure

```
├── index.html               # Main Single-Page Application interface
├── css/
│   ├── style.css            # Minimal Luxury UI system, themes & components
│   └── print.css            # High-contrast A4 print stylesheet
├── js/
│   ├── app.js               # Core application modules & controllers
│   ├── supabase.js          # Supabase client, auth & database service layer
│   ├── store.js             # Data store adapter & state management
│   ├── utils.js             # Formatting, Bengali Taka words, autocomplete
│   └── lib/
│       ├── jspdf.umd.min.js             # jsPDF vector engine
│       └── jspdf.plugin.autotable.min.js # autoTable plugin
├── assets/
│   └── logo.svg             # Default brand logo
├── supabase-schema.sql      # Complete PostgreSQL DDL with RLS & Triggers
└── README.md                # Comprehensive documentation
```
