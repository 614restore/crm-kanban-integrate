# Save TrussCTR Logo Instructions

## Quick Steps to Add Your Logo

1. **Save the logo image you provided** to this location:
   ```
   /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate/public/trussctr-logo.png
   ```

2. **Option A - Drag and Drop (Easiest)**
   - Open Finder and navigate to: `Documents/GitHub/crm-kanban-integrate/public/`
   - Drag your TrussCTR logo image into this folder
   - Rename it to: `trussctr-logo.png`

3. **Option B - Command Line**
   ```bash
   # If you have the logo saved somewhere, copy it:
   cp ~/Downloads/trussctr-logo.png ~/Documents/GitHub/crm-kanban-integrate/public/trussctr-logo.png
   ```

4. **Option C - Download from URL (if you have it hosted)**
   ```bash
   cd ~/Documents/GitHub/crm-kanban-integrate/public
   curl -o trussctr-logo.png "YOUR_IMAGE_URL_HERE"
   ```

## What's Been Updated

The following files now use the new logo:
- ✅ Login/Signup page (`AuthPage.tsx`)
- ✅ Loading screen (`AppLayout.tsx`)
- ✅ Sidebar (`Sidebar.tsx`)

## After Saving the Logo

Run these commands to deploy:

```bash
cd ~/Documents/GitHub/crm-kanban-integrate

# Add and commit changes
git add .
git commit -m "Update branding with new TrussCTR logo and background"

# Deploy to GitHub Pages
npm run deploy
```

## Verify the Logo

After deployment, visit your site and you should see:
- New TrussCTR shield logo on login page
- Background image from your restore-web site with opacity overlay
- Same logo on loading screen and sidebar

The site will be live at: https://614restore.github.io/crm-kanban-integrate/
