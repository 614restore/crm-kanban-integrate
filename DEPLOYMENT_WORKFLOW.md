# Deployment Workflow - Getting Updates to All Platforms

**Question:** Once I fix a bug or add a feature, how do I get it to web, desktop, and mobile?

---

## Quick Answer

**For this pipeline fix:**

```bash
# 1. Commit the fix
git add src/components/crm/PipelineStageTracker.tsx
git commit -m "Fix pipeline status mapping for inspection_scheduled"
git push

# 2. Deploy to platforms:
# - Web: Automatic (Vercel deploys main branch)
# - Desktop: Sync branch, rebuild
# - iOS: Sync Capacitor, rebuild in Xcode
```

---

## Detailed Workflow by Platform

### 🌐 Web App (Vercel)

**Auto-deploys from main branch!**

```bash
# Make changes on main branch
git checkout main
# ... edit files ...
git add .
git commit -m "Fix bug"
git push origin main
```

**Vercel automatically:**
1. Detects push to main
2. Runs `npm run build`
3. Deploys to https://crm-kanban-integrate.vercel.app
4. **Live in 1-2 minutes!**

**Verify deployment:**
- Check Vercel dashboard: https://vercel.com/dashboard
- Visit: https://app.trussctr.com
- Should see fix immediately

---

### 🖥️ Desktop App (Tauri)

**Manual sync required** (desktop is on separate branch)

```bash
# Sync main changes to desktop branch
git checkout desktop-tauri
git merge main
npm install  # If package.json changed

# Test desktop app
npm run tauri:dev
# Verify fix works in desktop window

# Commit merge
git push origin desktop-tauri
```

**Why merge?**
- Desktop branch has `src-tauri/` folder
- Main branch has your React code fixes
- Merging brings React fixes to desktop branch
- Desktop uses same React code, just wrapped in Tauri

**Build for distribution:**
```bash
# Build Mac app
npm run tauri:build:mac
# Creates: src-tauri/target/release/bundle/macos/TrussCTR.app

# Distribute to users via Mac App Store or direct download
```

---

### 📱 iOS App (Capacitor)

**Manual sync required**

```bash
# Make sure you're on main with latest changes
git checkout main
git pull

# Sync web changes to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios

# In Xcode:
# 1. Build the app (Cmd+B)
# 2. Test in simulator or device
# 3. Archive for App Store (Product → Archive)
```

**What `npx cap sync ios` does:**
1. Builds web app: `npm run build`
2. Copies `dist/` folder to iOS project
3. Updates iOS dependencies if needed
4. iOS app now has your latest React code

**Deploy to users:**
- Upload to App Store via Xcode → Archive
- Apple reviews (1-2 days)
- Users get update via App Store

---

## Complete Deployment Checklist

### For a typical bug fix:

- [ ] **1. Fix on main branch**
  ```bash
  git checkout main
  # ... make changes ...
  git add .
  git commit -m "Fix pipeline bug"
  git push origin main
  ```

- [ ] **2. Web deploys automatically** ✅
  - Vercel detects push
  - Builds and deploys
  - Live in 1-2 minutes

- [ ] **3. Sync to desktop branch**
  ```bash
  git checkout desktop-tauri
  git merge main
  npm run tauri:dev  # Test it
  git push origin desktop-tauri
  ```

- [ ] **4. Sync to iOS**
  ```bash
  git checkout main
  npx cap sync ios
  npx cap open ios
  # Build in Xcode
  ```

- [ ] **5. Verify all platforms**
  - Web: Open https://app.trussctr.com
  - Desktop: `npm run tauri:dev` on desktop-tauri branch
  - iOS: Run in Xcode simulator

---

## Platform Update Timeline

| Platform | How | Time to Live |
|----------|-----|--------------|
| **Web (Vercel)** | Automatic on push to main | 1-2 minutes |
| **Desktop (Dev)** | Merge + rebuild locally | Immediate (local) |
| **Desktop (Prod)** | Build + distribute | Manual distribution |
| **iOS (Dev)** | `cap sync` + Xcode build | 2-5 minutes |
| **iOS (Prod)** | App Store submission | 1-2 days (Apple review) |

---

## Current Branch Strategy

```
main branch (PRODUCTION)
  ↓
  ├─→ Vercel (auto-deploys web app)
  ├─→ Capacitor iOS (manual sync)
  └─→ desktop-tauri branch (merge to update)
       └─→ Tauri desktop app
```

**Key insight:** Your React code lives in `src/` and is shared across all platforms. When you fix a bug in `src/`, it needs to be synced to each platform wrapper.

---

## Example: Fix Pipeline Bug

### Step 1: Fix on main
```bash
git checkout main
# Edit: src/components/crm/PipelineStageTracker.tsx
git add src/components/crm/PipelineStageTracker.tsx
git commit -m "Fix pipeline status mapping

Added inspection_scheduled to status mapping so pipeline progress
shows correct stage instead of defaulting to 'New Lead'.

Fixes: Pipeline showing 'New Lead' when contact is 'Inspection Complete'
"
git push origin main
```

**Result:** Web app updates automatically via Vercel ✅

### Step 2: Update desktop
```bash
git checkout desktop-tauri
git merge main
# Test it works
npm run tauri:dev
# If good, push
git push origin desktop-tauri
```

**Result:** Desktop has the fix ✅

### Step 3: Update iOS
```bash
git checkout main
npx cap sync ios
npx cap open ios
# Test in Xcode simulator
```

**Result:** iOS has the fix ✅

### Step 4: Verify
- ✅ Open web app → Check Mary J Caldwell → Pipeline says "Inspection Done"
- ✅ Open desktop app → Same contact → Pipeline says "Inspection Done"
- ✅ Open iOS simulator → Same contact → Pipeline says "Inspection Done"

**All platforms synced!** 🎉

---

## Hot Reload During Development

### Web
```bash
npm run dev
# Edit files → Auto-reloads in browser
```

### Desktop
```bash
npm run tauri:dev
# Edit files → Auto-reloads in desktop window
```

### iOS
```bash
# In Xcode, run on simulator
# Edit files → Stop and rebuild (no auto-reload)
# OR use live reload:
npx cap run ios --livereload
```

---

## Production Builds

### Web (Vercel)
```bash
# Already automatic on push to main
# No manual build needed
```

### Desktop Mac
```bash
git checkout desktop-tauri
npm run tauri:build:mac
# Output: src-tauri/target/release/bundle/macos/TrussCTR.app
# Distribute via Mac App Store or DMG
```

### Desktop Windows
```bash
git checkout desktop-tauri
npm run tauri:build:windows  # Need Windows or VM
# Output: src-tauri/target/release/bundle/msi/TrussCTR_1.0.0.msi
# Distribute via Microsoft Store or direct download
```

### iOS
```bash
git checkout main
npx cap sync ios
npx cap open ios
# Xcode: Product → Archive
# Upload to App Store Connect
```

---

## Common Issues

### "Desktop has old code after fixing bug"
**Fix:** Merge main to desktop-tauri
```bash
git checkout desktop-tauri
git merge main
npm run tauri:dev
```

### "iOS has old code after fixing bug"
**Fix:** Sync Capacitor
```bash
npx cap sync ios
npx cap open ios
# Rebuild in Xcode
```

### "Web deployed but looks cached"
**Fix:** Hard refresh
```
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows)
```

### "Merge conflicts on desktop-tauri"
**Fix:** Resolve conflicts
```bash
git checkout desktop-tauri
git merge main
# Fix conflicts in VS Code
git add .
git commit -m "Merge main with conflict resolution"
```

---

## Best Practices

### 1. Always work on main first
```bash
# ✅ RIGHT: Fix on main, merge to desktop
git checkout main
# ... make changes ...
git push

git checkout desktop-tauri
git merge main
```

```bash
# ❌ WRONG: Fix on desktop, can't easily sync to main
git checkout desktop-tauri
# ... make changes ...
# Now how do I get this to main/iOS? Messy!
```

### 2. Test on all platforms before releasing
- Test on web (dev mode)
- Test on desktop (dev mode)
- Test on iOS simulator
- Then push to production

### 3. Keep desktop synced regularly
```bash
# Every few days or after major changes
git checkout desktop-tauri
git merge main
git push
```

### 4. Use feature branches for big changes
```bash
git checkout -b feature/new-pipeline
# ... work ...
git push origin feature/new-pipeline
# PR to main → Vercel previews it
# Merge to main → Goes live
# Merge main to desktop-tauri
```

---

## Summary - Your Workflow

**Daily development:**
1. Work on `main` branch
2. Push to GitHub
3. Vercel auto-deploys web
4. Manually sync to desktop/iOS when needed

**Weekly/as needed:**
1. Merge main → desktop-tauri
2. Sync iOS with `npx cap sync`
3. Test all platforms

**Before release:**
1. Test on web, desktop, iOS
2. Build desktop apps
3. Submit iOS to App Store
4. All platforms have same features ✅

---

**Key takeaway:** Fix bugs on `main`, push once, sync to other platforms. Web is automatic, desktop/iOS need manual sync.

*verified by vibecheck*
