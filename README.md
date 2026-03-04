# TrussCTR CRM - Kanban Integration

A comprehensive CRM application with Kanban board integration, built with React, TypeScript, Vite, and Supabase.

## 🚨 CRITICAL SECURITY NOTICE

**⚠️ HARDCODED CREDENTIALS REMOVED** - Security vulnerability has been fixed.

**REQUIRED STEPS BEFORE RUNNING:**

1. **Copy environment template**:
   ```bash
   cp .env.example .env.local  # Use .env.local for better security
   ```

2. **Configure your Supabase credentials** in `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **⚠️ NEVER commit `.env` or `.env.local` files to Git**

The application will not run without proper environment configuration.

## 🚀 Features

- **Dashboard**: Overview of key metrics, recent activities, and analytics
- **Pipeline Board**: Visual Kanban boards for sales and project management
- **Contact Management**: Full CRM with contact details, insurance info, and project tracking
- **Communication Hub**: Centralized communication tracking (calls, emails, SMS)
- **Calendar**: Appointment scheduling and management
- **Document Center**: File management and organization
- **Financial Dashboard**: Invoice tracking and financial reporting
- **Team Management**: User roles, permissions, and team collaboration
- **Automation**: Workflow automation and triggers
- **AI Assistant**: AI-powered insights and assistance
- **Real-time Updates**: Live synchronization across all users

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Git

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/614restore/crm-kanban-integrate.git
cd crm-kanban-integrate
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up Supabase Database

You'll need to create the following tables in your Supabase project:

- `profiles` - User profiles and company info
- `companies` - Company/organization data
- `contacts` - Contact information
- `appointments` - Calendar appointments
- `invoices` - Invoice records
- `invoice_items` - Invoice line items
- `communications` - Communication logs
- `kanban_boards` - Board configurations
- `kanban_columns` - Board columns
- `lead_sources` - Lead source tracking
- `automations` - Workflow automations
- `documents` - File metadata

**Note**: The app will work with mock data if the database is not configured, allowing you to test the UI immediately.

### 5. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:8080`

## 📦 Building for Production

### Standard Build

```bash
npm run build
```

### Development Build (with source maps)

```bash
npm run build:dev
```

### Preview Production Build

```bash
npm run preview
```

## 🌐 Deployment

### Deploy to GitHub Pages

The project is configured for GitHub Pages deployment:

```bash
npm run deploy
```

This will:
1. Build the production bundle
2. Deploy to the `gh-pages` branch
3. Make the app available at: `https://614restore.github.io/crm-kanban-integrate/`

### Deploy to Other Platforms

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

## 🔧 Technology Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: React Context + Reducer
- **Data Fetching**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React

## 📁 Project Structure

```
src/
├── components/
│   ├── crm/              # CRM feature components
│   ├── ui/               # Reusable UI components (shadcn)
│   └── theme-provider.tsx
├── contexts/
│   └── AppContext.tsx    # Legacy context (if used)
├── lib/
│   ├── authContext.tsx   # Authentication context
│   ├── crmData.ts        # Mock data and types
│   ├── crmStore.ts       # State management
│   ├── database.ts       # Supabase database operations
│   ├── supabase.ts       # Supabase client
│   └── utils.ts          # Utility functions
├── pages/
│   ├── Index.tsx         # Main app page
│   └── NotFound.tsx      # 404 page
├── App.tsx               # App root component
└── main.tsx              # Entry point
```

## 🎨 Key Components

- **AppLayout**: Main layout with auth gate
- **Dashboard**: Analytics and metrics overview
- **PipelineBoard**: Drag-and-drop Kanban boards
- **ContactList/ContactDetail**: Contact management
- **CalendarView**: Appointment scheduling
- **FinancialDashboard**: Invoice and payment tracking
- **TeamView**: Team member management
- **QuickAddModal**: Quick-add interface for contacts/appointments
- **InvoiceModal**: Invoice creation and editing

## 🔐 Authentication

The app uses Supabase Authentication with:
- Email/Password login
- Password reset
- Session persistence
- Real-time auth state management

## 🐛 Troubleshooting

### Build Errors

**Issue**: Module not found errors
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: TypeScript errors
```bash
# Check your TypeScript version
npm list typescript

# Reinstall if needed
npm install typescript@latest -D
```

### Runtime Errors

**Issue**: Supabase connection errors
- Verify your `.env` file has correct credentials
- Check Supabase project is active
- Verify API keys are not expired

**Issue**: Routing not working on GitHub Pages
- The base path is configured in `vite.config.ts`
- Ensure `BrowserRouter` has the correct `basename` prop

**Issue**: 404 on page refresh
- Add a `404.html` that redirects to `index.html` for GitHub Pages
- Or use HashRouter instead of BrowserRouter

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run build:dev` - Development build with source maps
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run doctor` - Validate repository health checks
- `npm run test` - Run automated regression tests
- `npm run test:month` - Run accelerated 30-day soak simulation
- `npm run e2e:invite` - Run invite end-to-end script (requires env vars)
- `npm run ci:quality` - Run doctor + tests + soak + build
- `npm run deploy` - Deploy to GitHub Pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For issues or questions:
- Open an issue on GitHub
- Contact: 614restorellc@gmail.com

## 🎯 Roadmap

- [ ] Mobile app version
- [ ] Advanced reporting and analytics
- [ ] Email integration (Gmail, Outlook)
- [ ] SMS integration (Twilio)
- [ ] QuickBooks integration
- [ ] Advanced automation workflows
- [ ] Role-based access control (RBAC)
- [ ] Multi-language support
- [ ] Dark mode enhancements

---

**Built with ❤️ by 614 Restore**

<-- Disable RLS on companies table
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = Updated: Tue Mar  3 17:28:53 EST 2026 -->
