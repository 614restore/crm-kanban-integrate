# 🚀 Quick Start Guide

Get your CRM up and running in 5 minutes!

## Option 1: Deploy Without Database (Demo Mode) ⚡

Perfect for testing the UI and all button functionality immediately.

```bash
# 1. Clone and install
git clone https://github.com/614restore/crm-kanban-integrate.git
cd crm-kanban-integrate
npm install

# 2. Deploy to GitHub Pages
npm run deploy
```

**That's it!** ✨ 

Your app will be live at: `https://614restore.github.io/crm-kanban-integrate/`

The app will run with mock data, so all buttons and features work perfectly without database setup.

---

## Option 2: Full Setup with Database 📊

For production use with real data persistence.

### Step 1: Set Up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create free account
2. Create a new project
3. Wait for project to initialize (~2 minutes)
4. Go to **Settings** → **API**
5. Copy your **Project URL** and **anon/public key**

### Step 2: Configure Environment

```bash
# Create .env file
cp .env.example .env
```

Edit `.env` and paste your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Set Up Database (Optional)

Create these tables in Supabase SQL Editor:

```sql
-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_id UUID REFERENCES companies(id),
  role TEXT DEFAULT 'sales',
  avatar_url TEXT,
  phone TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone1 TEXT,
  phone2 TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  status TEXT DEFAULT 'new',
  lead_source TEXT,
  assigned_to TEXT,
  tags TEXT[],
  insurance_company TEXT,
  policy_number TEXT,
  claim_number TEXT,
  adjuster_name TEXT,
  adjuster_phone TEXT,
  adjuster_email TEXT,
  deductible DECIMAL,
  project_type TEXT,
  project_value DECIMAL,
  deposit_amount DECIMAL,
  deposit_paid BOOLEAN DEFAULT false,
  deposit_date DATE,
  final_payment_amount DECIMAL,
  final_payment_paid BOOLEAN DEFAULT false,
  final_payment_date DATE,
  is_retail BOOLEAN DEFAULT false,
  retail_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (basic - customize as needed)
CREATE POLICY "Users can view their company data" ON contacts
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert company data" ON contacts
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update company data" ON contacts
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));
```

**Note**: Additional tables for appointments, invoices, etc. follow similar patterns.

### Step 4: Configure GitHub Secrets (for auto-deploy)

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add repository secrets:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

### Step 5: Deploy

```bash
# Test locally first
npm run dev

# Build and deploy
npm run deploy
```

Or just push to main - GitHub Actions will auto-deploy!

```bash
git add .
git commit -m "Configure for production"
git push origin main
```

---

## 🎯 Testing Checklist

After deployment, verify these features work:

### Navigation
- [ ] Click all sidebar menu items
- [ ] Navigate between views
- [ ] Back/forward browser buttons work

### Dashboard
- [ ] View metrics and charts
- [ ] Quick actions panel works
- [ ] Recent activity displays

### Contacts
- [ ] Click "+ New Contact" button
- [ ] Fill out contact form
- [ ] Save contact
- [ ] Edit existing contact
- [ ] Delete contact
- [ ] Search contacts
- [ ] Filter by status

### Pipeline Board
- [ ] View kanban boards
- [ ] Switch between boards
- [ ] Drag and drop cards (if enabled)
- [ ] Click on card to view details

### Calendar
- [ ] View calendar
- [ ] Click "+ New Appointment"
- [ ] Create appointment
- [ ] Edit appointment
- [ ] Delete appointment

### Financial
- [ ] View invoices
- [ ] Click "Create Invoice"
- [ ] Fill invoice form
- [ ] Save invoice
- [ ] Mark invoice as paid

### Quick Add Modal
- [ ] Click "+" button in top bar
- [ ] Quick add contact
- [ ] Quick add appointment

### Settings
- [ ] Access settings
- [ ] Update profile
- [ ] View team members
- [ ] Configure preferences

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
# Check Node version (need 18+)
node --version

# Update if needed
nvm install 20
nvm use 20
```

### Buttons not responding
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Try hard refresh (Ctrl+Shift+R)

### Routing issues on GitHub Pages
- The app is configured correctly with:
  - ✅ `basename` in BrowserRouter
  - ✅ `404.html` for SPA routing
  - ✅ Correct base path in vite.config.ts

### Authentication not working
1. Verify Supabase credentials in `.env`
2. Check Supabase auth settings:
   - Site URL should be your deployed URL
   - Redirect URLs configured
3. Clear browser cache and cookies

---

## 📚 Next Steps

1. **Customize branding**: Update logo, colors, company name
2. **Configure email**: Set up SMTP for notifications
3. **Add team members**: Invite users via Supabase auth
4. **Set up automations**: Configure workflow triggers
5. **Integrate services**: Connect QuickBooks, Twilio, etc.
6. **Mobile optimization**: Test on various devices
7. **Performance tuning**: Monitor and optimize load times

---

## 🆘 Need Help?

- **Full Documentation**: See [README.md](README.md)
- **Deployment Guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Issues**: Open a GitHub issue
- **Email**: 614restorellc@gmail.com

---

**Happy CRM-ing! 🎉**
