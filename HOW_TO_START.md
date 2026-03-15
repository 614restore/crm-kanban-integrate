# 🚀 How to Start TrussCTR Dev Server

## ❌ Problem: You're in the wrong directory!

When you see:
```
npm error Missing script: "dev"
```

It means you're not in the project folder.

---

## ✅ Solution: Navigate to Project First

### Option 1: Manual Navigation (Copy & Paste These Commands)

```bash
cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate
npm run dev
```

### Option 2: Use the Start Script (From Anywhere)

```bash
/Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate/start.sh
```

Or if you're already in the project directory:
```bash
./start.sh
```

---

## 📍 How to Know You're in the Right Directory

When you run `pwd`, you should see:
```
/Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate
```

When you run `ls`, you should see:
```
package.json
src/
public/
node_modules/
...
```

---

## 🎯 Complete Step-by-Step

1. **Open Terminal**

2. **Navigate to project**:
   ```bash
   cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate
   ```

3. **Verify you're in the right place**:
   ```bash
   pwd
   ```
   Should show: `/Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate`

4. **Start the dev server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   - Go to: `http://localhost:8081` (or 8080)

6. **Hard refresh browser**:
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

---

## 🎨 What You'll See

After hard refresh:
- ✨ Large TrussCTR logo (128px)
- ✨ Animated background with floating orbs
- ✨ Gradient title
- ✨ Progress bar
- ✨ Bouncing dots

---

## 🔧 Quick Commands

```bash
# Check where you are
pwd

# Go to project
cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate

# Start server
npm run dev

# Or use the script from anywhere
/Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate/start.sh
```

---

## 📝 Create an Alias (Optional)

Add this to your `~/.zshrc` file:

```bash
alias trussctr="cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate && npm run dev"
```

Then you can just type:
```bash
trussctr
```

From anywhere to start the server!

---

## 🆘 Still Having Issues?

1. **Make sure you're in the project directory**:
   ```bash
   cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate
   ```

2. **Check if node_modules exists**:
   ```bash
   ls node_modules
   ```
   If not found, run:
   ```bash
   npm install
   ```

3. **Then start**:
   ```bash
   npm run dev
   ```

---

**Remember: Always navigate to the project directory first!** 📁
