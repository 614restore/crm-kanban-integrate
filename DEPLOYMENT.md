# Deployment Checklist for StormCraft CRM

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] `.env` file created with Supabase credentials
- [ ] Supabase URL is correct (format: `https://xxxxx.supabase.co` or custom domain)
- [ ] Supabase anonymous key is correct
- [ ] Test Supabase connection locally

### 2. Code Quality
- [ ] No TypeScript errors: `npm run build`
- [ ] No ESLint errors: `npm run lint`
- [ ] All dependencies installed: `npm install`
- [ ] Test app locally: `npm run dev`

### 3. Configuration Files
- [x] `vite.config.ts` has correct base path for GitHub Pages
- [x] `package.json` has correct homepage URL
- [x] `App.tsx` uses basename for BrowserRouter
- [x] `404.html` exists in public folder for SPA routing

### 4. Supabase Database (Optional for Demo)
- [ ] Database tables created (or using mock data)
- [ ] Row Level Security (RLS) policies configured
- [ ] Authentication enabled
- [ ] Storage buckets created (if using file uploads)

### 5. Build Test
- [ ] Production build succeeds: `npm run build`
- [ ] Preview build locally: `npm run preview`
- [ ] Test all features in preview mode
- [ ] Check browser console for errors

## 🚀 Deployment Steps

### Option 1: GitHub Pages (Recommended for this project)

```bash
# Build and deploy in one command
npm run deploy
```

This will:
1. Run production build
2. Deploy to `gh-pages` branch
3. App available at: https://614restore.github.io/crm-kanban-integrate/

**Post-Deployment**:
- [ ] Visit deployed URL
- [ ] Test authentication flow
- [ ] Test navigation (all routes)
- [ ] Test key features (add contact, create appointment, etc.)
- [ ] Check responsiveness on mobile
- [ ] Test in different browsers (Chrome, Firefox, Safari, Edge)

### Option 2: Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login and deploy:
```bash
vercel login
vercel
```

3. Set environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Redeploy to apply env vars:
```bash
vercel --prod
```

### Option 3: Netlify

1. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

2. Login and deploy:
```bash
netlify login
netlify init
netlify deploy --prod
```

3. Set environment variables in Netlify dashboard or via CLI:
```bash
netlify env:set VITE_SUPABASE_URL "your_url"
netlify env:set VITE_SUPABASE_ANON_KEY "your_key"
```

## 🔧 Post-Deployment Configuration

### Update Supabase Auth Settings

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your deployed URL to **Site URL**:
   - `https://614restore.github.io/crm-kanban-integrate/`
3. Add redirect URLs:
   - `https://614restore.github.io/crm-kanban-integrate/`
   - `https://614restore.github.io/crm-kanban-integrate/**`

### Enable CORS (if needed)

1. Go to Supabase Dashboard > Settings > API
2. Add your domain to allowed origins

## 🐛 Common Issues & Solutions

### Issue: Blank page after deployment

**Solution 1**: Check browser console for errors
- Open DevTools (F12)
- Look for 404 errors or CORS errors
- Verify all assets are loading from correct paths

**Solution 2**: Verify base path configuration
- Check `vite.config.ts` has correct base path
- Check `App.tsx` uses `basename` prop in BrowserRouter

### Issue: 404 on page refresh

**Solution**: The `404.html` file should handle this automatically for GitHub Pages.

If still broken:
1. Verify `public/404.html` was copied to dist folder
2. Clear browser cache
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Authentication not working

**Solutions**:
1. Check Supabase redirect URLs are configured correctly
2. Verify environment variables are set in deployment platform
3. Check browser console for auth errors
4. Try incognito/private mode to rule out cache issues

### Issue: Can't connect to Supabase

**Solutions**:
1. Verify Supabase project is active (not paused)
2. Check API keys are correct and not expired
3. Verify CORS settings in Supabase
4. Check network tab for failed requests
5. Try mock data mode (app should work without database)

### Issue: Styles not loading

**Solutions**:
1. Check Tailwind CSS is properly configured
2. Verify PostCSS config is correct
3. Clear build cache: `rm -rf dist node_modules/.vite`
4. Rebuild: `npm run build`

### Issue: Images/assets not loading

**Solutions**:
1. Use absolute paths for static assets
2. Place assets in `public/` folder
3. Use `import.meta.env.BASE_URL` for dynamic base paths
4. Check browser DevTools Network tab for 404s

## 📊 Performance Optimization

### Before Production Deploy

1. **Enable production mode**:
   - Build uses `NODE_ENV=production` automatically

2. **Optimize bundle size**:
```bash
# Analyze bundle
npm run build
npx vite-bundle-visualizer
```

3. **Enable compression** (if hosting allows):
   - Gzip compression
   - Brotli compression

4. **Lazy load routes** (already implemented via React Router)

5. **Image optimization**:
   - Compress images before uploading
   - Use WebP format where possible
   - Implement lazy loading for images

## 🔒 Security Checklist

- [ ] Environment variables not committed to git (check `.gitignore`)
- [ ] Using anonymous key (not service role key) in frontend
- [ ] Supabase RLS policies enabled
- [ ] HTTPS enabled (automatic on GitHub Pages)
- [ ] Auth tokens stored securely (handled by Supabase)
- [ ] No sensitive data in console.log statements
- [ ] Rate limiting configured in Supabase (optional)

## 📝 Monitoring

### Post-Launch Monitoring

1. **Check deployment status**:
   - GitHub Actions tab for build status
   - Deployment platform dashboard

2. **Monitor errors**:
   - Browser console in production
   - Supabase logs
   - Consider adding error tracking (Sentry, LogRocket)

3. **Performance monitoring**:
   - Lighthouse scores
   - Core Web Vitals
   - Page load times

## 🔄 Rollback Plan

If deployment fails:

### GitHub Pages
```bash
# Revert to previous commit
git revert HEAD
git push origin main
npm run deploy
```

### Other Platforms
- Use platform's rollback feature
- Or deploy previous git commit

## ✨ Success Criteria

Your deployment is successful when:

- [x] App loads without errors
- [x] All pages are accessible
- [x] Authentication works
- [x] Can create/edit/delete data
- [x] Real-time updates work (if using Supabase)
- [x] Mobile responsive
- [x] Fast load times (<3s initial load)
- [x] No console errors
- [x] Works in major browsers

## 📧 Support

If you encounter issues not covered here:

1. Check GitHub Issues
2. Review Supabase docs: https://supabase.com/docs
3. Check Vite docs: https://vitejs.dev
4. Contact: 614restorellc@gmail.com

---

**Last Updated**: February 2026
