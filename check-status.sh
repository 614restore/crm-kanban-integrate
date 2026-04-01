#!/bin/bash

echo "🔍 TrussCTR - Status Check"
echo "=========================="
echo ""

# Check logo file
echo "📁 Logo File:"
if [ -f "public/logo.png" ]; then
    ls -lh public/logo.png | awk '{print "   ✅ Size: " $5 " | Modified: " $6 " " $7 " " $8}'
else
    echo "   ❌ NOT FOUND"
fi
echo ""

# Check code changes
echo "💻 Code Changes:"
echo -n "   LoadingScreen: "
if grep -q "w-32 h-32 object-contain drop-shadow-2xl" src/components/AppLayout.tsx; then
    echo "✅"
else
    echo "❌"
fi

echo -n "   AuthPage: "
if grep -q 'src="/logo.png"' src/components/crm/AuthPage.tsx; then
    echo "✅"
else
    echo "❌"
fi

echo -n "   Sidebar: "
if grep -q 'src="/logo.png"' src/components/crm/Sidebar.tsx; then
    echo "✅"
else
    echo "❌"
fi

echo -n "   package.json: "
if grep -q '"type": "module"' package.json; then
    echo "✅"
else
    echo "❌"
fi
echo ""

# Check if dev server is running
echo "🚀 Dev Server:"
if pgrep -f "vite" > /dev/null; then
    echo "   ✅ Running"
    echo "   📍 Likely at: http://localhost:8081 or http://localhost:8080"
else
    echo "   ❌ Not running"
    echo "   💡 Run: npm run dev"
fi
echo ""

echo "=========================="
echo "📋 Next Steps:"
echo "1. If dev server is running: Stop it (Ctrl+C) and restart"
echo "2. Run: npm run dev"
echo "3. Open browser and do HARD REFRESH:"
echo "   • Mac: Cmd + Shift + R"
echo "   • Windows: Ctrl + Shift + R"
echo "=========================="
