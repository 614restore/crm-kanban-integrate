#!/bin/bash

# TrussCTR - Restart and Verify Script
# This script ensures all changes are live and running

echo "🔄 TrussCTR - Restarting Development Server"
echo "=========================================="
echo ""

# Step 1: Kill existing Vite processes
echo "1️⃣  Stopping existing dev server..."
pkill -f "vite" 2>/dev/null
sleep 2
echo "   ✅ Dev server stopped"
echo ""

# Step 2: Verify logo file exists
echo "2️⃣  Verifying logo file..."
if [ -f "public/logo.png" ]; then
    SIZE=$(ls -lh public/logo.png | awk '{print $5}')
    echo "   ✅ Logo found: $SIZE"
else
    echo "   ❌ Logo NOT found at public/logo.png"
    exit 1
fi
echo ""

# Step 3: Verify code changes
echo "3️⃣  Verifying code changes..."

# Check AppLayout.tsx for new loading screen
if grep -q "w-32 h-32 object-contain drop-shadow-2xl" src/components/AppLayout.tsx; then
    echo "   ✅ LoadingScreen updated"
else
    echo "   ❌ LoadingScreen NOT updated"
fi

# Check AuthPage.tsx for logo
if grep -q 'src="/logo.png"' src/components/crm/AuthPage.tsx; then
    echo "   ✅ AuthPage updated"
else
    echo "   ❌ AuthPage NOT updated"
fi

# Check Sidebar.tsx for logo
if grep -q 'src="/logo.png"' src/components/crm/Sidebar.tsx; then
    echo "   ✅ Sidebar updated"
else
    echo "   ❌ Sidebar NOT updated"
fi

# Check package.json for module type
if grep -q '"type": "module"' package.json; then
    echo "   ✅ package.json has module type"
else
    echo "   ❌ package.json missing module type"
fi

echo ""

# Step 4: Clear browser cache instructions
echo "4️⃣  Browser Cache Instructions:"
echo "   📌 After server starts, do a HARD REFRESH:"
echo "   • Mac: Cmd + Shift + R"
echo "   • Windows/Linux: Ctrl + Shift + R"
echo "   • Or open DevTools and right-click refresh → Empty Cache and Hard Reload"
echo ""

# Step 5: Start dev server
echo "5️⃣  Starting development server..."
echo "   🚀 Running: npm run dev"
echo ""
echo "=========================================="
echo "Once server starts:"
echo "1. Open http://localhost:8081 (or 8080)"
echo "2. Do a HARD REFRESH (Cmd+Shift+R)"
echo "3. You should see the new loading screen with:"
echo "   ✨ Large TrussCTR logo (128px)"
echo "   ✨ Animated background orbs"
echo "   ✨ Gradient title"
echo "   ✨ Progress bar"
echo "=========================================="
echo ""

# Start the dev server
npm run dev
