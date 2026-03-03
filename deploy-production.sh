#!/bin/bash

# 🚀 StormCraft CRM Production Deployment Script
# This script performs comprehensive validation and deployment to production

set -e  # Exit on any error

echo "🚀 Starting StormCraft CRM Production Deployment Process"
echo "============================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if git working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Git working directory is not clean. Consider committing changes before deployment."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Environment check
print_step "Checking deployment environment..."

# Check Node.js version
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# Check npm version  
NPM_VERSION=$(npm --version)
print_success "npm version: $NPM_VERSION"

# Check if .env.local exists for production
if [ ! -f ".env.local" ]; then
    print_warning ".env.local not found. Make sure environment variables are configured."
fi

# Step 2: Clean previous builds
print_step "Cleaning previous builds and dependencies..."
rm -rf dist
rm -rf node_modules/.cache
print_success "Cleaned build artifacts"

# Step 3: Install fresh dependencies
print_step "Installing fresh dependencies..."
npm ci
print_success "Dependencies installed"

# Step 4: TypeScript compilation check
print_step "Checking TypeScript compilation..."
if npm run type-check; then
    print_success "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Step 5: Linting check
print_step "Running code linting..."
if npm run lint; then
    print_success "Linting passed"
else
    print_error "Linting failed"
    exit 1
fi

# Step 6: Build for production
print_step "Building application for production..."
if npm run build:prod; then
    print_success "Production build successful"
else
    print_error "Production build failed"
    exit 1
fi

# Step 7: Check build size
print_step "Analyzing bundle size..."
DIST_SIZE=$(du -sh dist | cut -f1)
print_success "Build size: $DIST_SIZE"

# Check if main bundle is too large (warn if over 1MB)
MAIN_JS=$(find dist/assets -name "index-*.js" | head -1)
if [ -f "$MAIN_JS" ]; then
    MAIN_SIZE=$(stat -f%z "$MAIN_JS" 2>/dev/null || stat -c%s "$MAIN_JS" 2>/dev/null)
    MAIN_MB=$((MAIN_SIZE / 1024 / 1024))
    if [ $MAIN_MB -gt 1 ]; then
        print_warning "Main bundle is ${MAIN_MB}MB - consider code splitting"
    else
        print_success "Main bundle size acceptable: ${MAIN_MB}MB"
    fi
fi

# Step 8: Security audit
print_step "Running security audit..."
if npm audit --audit-level=moderate; then
    print_success "Security audit passed"
else
    print_warning "Security audit found issues - review before deploying"
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 9: Pre-deployment verification
print_step "Running pre-deployment verification..."

# Check critical files exist
CRITICAL_FILES=("dist/index.html" "dist/manifest.json" "dist/sw.js")
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_error "✗ $file missing"
        exit 1
    fi
done

# Check if service worker is properly configured
if grep -q "registerSW" dist/index.html; then
    print_success "✓ Service Worker registration found"
else
    print_warning "Service Worker registration not found in HTML"
fi

# Step 10: Test production build locally
print_step "Starting local preview server for testing..."
echo "🌐 Starting preview server at http://localhost:4173"
echo "   Please test the application in your browser"
echo "   Press Ctrl+C when testing is complete"

# Start preview in background and wait for user input
npm run preview &
PREVIEW_PID=$!

echo ""
read -p "Press Enter when you've finished testing the preview..."

# Kill preview server
kill $PREVIEW_PID 2>/dev/null || true

# Step 11: Final deployment confirmation
print_step "Ready for deployment!"
echo ""
echo "📋 Deployment Summary:"
echo "   • TypeScript: ✓ Compiled successfully"
echo "   • Linting: ✓ All checks passed"
echo "   • Build: ✓ Production build created"
echo "   • Bundle: ✓ Size analyzed ($DIST_SIZE total)"
echo "   • Security: ✓ Audit completed"
echo "   • Files: ✓ All critical files present"
echo "   • Testing: ✓ Local preview tested"
echo ""

read -p "Deploy to production? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Step 12: Deploy to GitHub Pages
print_step "Deploying to GitHub Pages..."
if gh-pages -d dist; then
    print_success "Deployment to GitHub Pages successful!"
else
    print_error "Deployment failed"
    exit 1
fi

# Step 13: Post-deployment verification
print_step "Performing post-deployment verification..."

# Wait a moment for GitHub Pages to update
sleep 5

# Try to fetch the deployed site
DEPLOYED_URL="https://614restore.github.io/crm-kanban-integrate/"
if curl -s -f -o /dev/null "$DEPLOYED_URL"; then
    print_success "✓ Site is accessible at $DEPLOYED_URL"
else
    print_warning "Site may not be accessible yet or URL is incorrect"
fi

# Final success message
echo ""
echo "🎉 Deployment Complete!"
echo "============================================================"
echo "   🌐 Production URL: $DEPLOYED_URL"
echo "   📊 Build Size: $DIST_SIZE" 
echo "   🕒 Deployed at: $(date)"
echo "   📝 Git Commit: $(git rev-parse --short HEAD)"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify all features work in production"
echo "   2. Monitor for any errors or issues"
echo "   3. Update team on successful deployment"
echo "   4. Document any lessons learned"
echo ""
print_success "StormCraft CRM is now live in production! 🚀"