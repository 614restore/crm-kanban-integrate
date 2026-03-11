# Deployment Guide

This project supports dual deployment to both **Vercel** and **GitHub Pages**.

## 🚀 Quick Deploy

### Deploy to Vercel (Primary - Production)
```bash
# Vercel will automatically deploy on push to main branch
# Or manually deploy:
vercel --prod
```

### Deploy to GitHub Pages (Secondary - Demo)
```bash
npm run deploy
```

---

## 📋 Deployment Configuration

### Vercel Configuration
- **Base URL**: `/` (root path)
- **Build Command**: `VITE_BASE_URL=/ npm run build`
- **Environment File**: `.env.production`
- **Auto-deploys**: On push to `main` branch

**Vercel Environment Variables** (Set in Vercel Dashboard):
```
VITE_SUPABASE_URL=your-production-supabase-url
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_BASE_URL=/
VITE_DEMO_MODE=false
```

### GitHub Pages Configuration
- **Base URL**: `/quotes-customize-manage/` (subpath)
- **Build Command**: `npm run build:gh-pages`
- **Environment File**: `.env.gh-pages`
- **Manual deploy**: `npm run deploy`

---

## 🔧 Build Scripts

| Script | Purpose | Base URL |
|--------|---------|----------|
| `npm run dev` | Local development | `/` |
| `npm run build` | Standard build (uses vite.config.ts logic) | Auto-detected |
| `npm run build:gh-pages` | GitHub Pages build | `/quotes-customize-manage/` |
| `npm run deploy` | Build + deploy to GitHub Pages | `/quotes-customize-manage/` |
| `npm run deploy:prod` | Full quality check + deploy to GH Pages | `/quotes-customize-manage/` |

---

## 🌐 Live URLs

- **Vercel (Production)**: https://your-app.vercel.app
- **GitHub Pages (Demo)**: https://614restore.github.io/quotes-customize-manage/

---

## 🔐 Environment Variables

### Required for Production (Vercel)
Set these in **Vercel Dashboard** → Project Settings → Environment Variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_BASE_URL=/
VITE_DEMO_MODE=false
```

### GitHub Pages (Demo Mode)
Uses `.env.gh-pages` file (committed to repo):
- Demo mode enabled by default
- No real Supabase credentials needed
- Works offline with mock data

---

## 🛠️ Troubleshooting

### Issue: Blank white page on GitHub Pages
**Solution**: Clear browser cache and ensure base URL is correct
```bash
npm run deploy
```

### Issue: 404 errors on page refresh (GitHub Pages)
**Solution**: The `public/404.html` file handles SPA routing

### Issue: Vercel deployment fails
**Solution**: Check environment variables are set in Vercel dashboard

### Issue: Service worker errors
**Solution**: Service worker is disabled in development, enabled in production

---

## 📝 Deployment Checklist

### Before Deploying to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Test build locally: `npm run build`
- [ ] Run quality checks: `npm run verify`
- [ ] Push to main branch (auto-deploys)

### Before Deploying to GitHub Pages
- [ ] Update `.env.gh-pages` if needed
- [ ] Test build: `npm run build:gh-pages`
- [ ] Preview: `npm run preview`
- [ ] Deploy: `npm run deploy`

---

## 🔄 Continuous Deployment

### Vercel (Automatic)
- Pushes to `main` → Production deployment
- Pull requests → Preview deployments
- Automatic HTTPS, CDN, and edge caching

### GitHub Pages (Manual)
- Run `npm run deploy` to update
- Builds to `gh-pages` branch
- Served via GitHub's CDN

---

## 📊 Monitoring

### Vercel
- View logs: Vercel Dashboard → Deployments → Logs
- Analytics: Vercel Dashboard → Analytics
- Performance: Vercel Dashboard → Speed Insights

### GitHub Pages
- Status: GitHub repo → Settings → Pages
- Traffic: GitHub repo → Insights → Traffic

---

## 🆘 Support

For deployment issues:
1. Check the console for errors
2. Verify environment variables
3. Clear browser cache
4. Check build logs
5. Contact: 614restorellc@gmail.com
