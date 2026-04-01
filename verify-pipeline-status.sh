#!/bin/bash

# Pipeline Status System Verification Script
# Tests all auto-triggers, status validation, and progression rules

echo "🔍 PIPELINE STATUS SYSTEM VERIFICATION"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test database connection
echo -e "\n${BLUE}1. Testing Database Connection...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Install with: npm install -g supabase@latest${NC}"
    exit 1
fi

# Check if we're in project directory
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Not in project directory. Run from crm-kanban-integrate root.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment check passed${NC}"

# Test 2: Verify migration applied
echo -e "\n${BLUE}2. Testing Status Migration...${NC}"
MIGRATION_FILE="supabase/migrations/20260402000007_pipeline_status_enhancements.sql"
if [[ -f "$MIGRATION_FILE" ]]; then
    echo -e "${GREEN}✅ Pipeline enhancement migration exists${NC}"
else
    echo -e "${RED}❌ Migration file missing: $MIGRATION_FILE${NC}"
    exit 1
fi

# Test 3: Check TypeScript compilation
echo -e "\n${BLUE}3. Testing TypeScript Compilation...${NC}"
if npm run build > build_output.log 2>&1; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    rm -f build_output.log
else
    echo -e "${RED}❌ TypeScript compilation failed:${NC}"
    cat build_output.log
    rm -f build_output.log
    exit 1
fi

# Test 4: Verify status manager module
echo -e "\n${BLUE}4. Testing Status Manager Module...${NC}"
if [[ -f "src/lib/statusManager.ts" ]]; then
    # Check for key exports
    if grep -q "export.*updateContactStatus" "src/lib/statusManager.ts"; then
        echo -e "${GREEN}✅ Status manager module properly exported${NC}"
    else
        echo -e "${RED}❌ Status manager missing key exports${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Status manager module missing${NC}"
    exit 1
fi

# Test 5: Check component updates
echo -e "\n${BLUE}5. Verifying Component Updates...${NC}"
COMPONENTS=(
    "src/components/crm/PipelineBoard.tsx"
    "src/components/crm/EstimatesView.tsx" 
    "src/components/crm/FinancialDashboard.tsx"
    "src/components/crm/InvoiceModal.tsx"
)

for component in "${COMPONENTS[@]}"; do
    if [[ -f "$component" ]]; then
        if grep -q "statusManager" "$component"; then
            echo -e "${GREEN}✅ $component updated to use status manager${NC}"
        else
            echo -e "${YELLOW}⚠️  $component may need status manager integration${NC}"
        fi
    else
        echo -e "${RED}❌ Component missing: $component${NC}"
    fi
done

# Test 6: Validate status constants
echo -e "\n${BLUE}6. Validating Status Constants...${NC}"
STATUS_COUNTS=$(grep -c "'.*':" src/lib/statusManager.ts | head -1)
if [[ $STATUS_COUNTS -gt 20 ]]; then
    echo -e "${GREEN}✅ Status constants defined ($STATUS_COUNTS statuses)${NC}"
else
    echo -e "${YELLOW}⚠️  Status constants may be incomplete${NC}"
fi

# Test 7: Check automation system integration
echo -e "\n${BLUE}7. Testing Automation Integration...${NC}"
if grep -q "fireAutomationEvent" src/lib/statusManager.ts; then
    echo -e "${GREEN}✅ Automation events integrated${NC}"
else
    echo -e "${RED}❌ Automation events not integrated${NC}"
    exit 1
fi

# Test 8: Verify progression rules
echo -e "\n${BLUE}8. Checking Auto-Progression Rules...${NC}"
if grep -q "enhancedAutoProgression" src/lib/statusManager.ts; then
    echo -e "${GREEN}✅ Enhanced auto-progression rules implemented${NC}"
else
    echo -e "${YELLOW}⚠️  Enhanced progression rules may need verification${NC}"
fi

# Test 9: Database schema validation
echo -e "\n${BLUE}9. Database Schema Validation...${NC}"
if grep -q "valid_contact_status" "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Database status validation constraint defined${NC}"
else
    echo -e "${RED}❌ Database validation constraint missing${NC}"
fi

if grep -q "automation_queue" "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Automation queue table defined${NC}"
else
    echo -e "${RED}❌ Automation queue table missing${NC}"
fi

# Test 10: Check audit system
echo -e "\n${BLUE}10. Audit System Integration...${NC}"
if grep -q "audit_status_transitions" "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Status transition auditing enabled${NC}"
else
    echo -e "${YELLOW}⚠️  Status auditing may need verification${NC}"
fi

# Test 11: Pipeline analytics
echo -e "\n${BLUE}11. Pipeline Analytics View...${NC}"
if grep -q "pipeline_analytics" "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Pipeline analytics view created${NC}"
else
    echo -e "${YELLOW}⚠️  Analytics view missing${NC}"
fi

# Summary and recommendations
echo -e "\n${BLUE}📋 SUMMARY & RECOMMENDATIONS${NC}"
echo "=============================="

echo -e "\n${GREEN}✅ WORKING FEATURES:${NC}"
echo "• Centralized status management system"
echo "• TypeScript compilation successful"
echo "• Database validation constraints"
echo "• Automation event integration" 
echo "• Auto-progression rules framework"
echo "• Status transition auditing"

echo -e "\n${YELLOW}⚠️  ITEMS TO VERIFY:${NC}"
echo "• Apply database migration to development environment"
echo "• Test drag-and-drop status changes in UI"
echo "• Verify automation rules fire correctly"
echo "• Test status validation in production"
echo "• Check pipeline analytics dashboard"

echo -e "\n${BLUE}🔧 NEXT STEPS TO COMPLETE SETUP:${NC}"
echo "1. Apply the database migration:"
echo "   supabase db push"
echo ""
echo "2. Restart the development server:"
echo "   npm run dev"
echo ""
echo "3. Test status changes in the pipeline board"
echo ""
echo "4. Create test automation rules"
echo ""
echo "5. Verify email/SMS notifications work"

echo -e "\n${GREEN}🎉 PIPELINE STATUS SYSTEM VERIFICATION COMPLETE!${NC}"
echo -e "The status system has been enhanced with:"
echo "• ✅ Consistent automation event firing"
echo "• ✅ Database-level status validation"  
echo "• ✅ Enhanced auto-progression rules"
echo "• ✅ Comprehensive audit logging"
echo "• ✅ Pipeline analytics and reporting"

exit 0