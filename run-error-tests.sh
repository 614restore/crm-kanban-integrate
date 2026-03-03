#!/bin/bash

# 🔍 COMPREHENSIVE ERROR HANDLING & EDGE CASE TESTING SCRIPT
# Contractor CRM Production Readiness Assessment
# Date: March 3, 2026

echo "🔍 CONTRACTOR CRM - COMPREHENSIVE ERROR HANDLING ASSESSMENT"
echo "=================================================================="
echo "Testing for production readiness and resilience"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}$1${NC}"
    echo "$(echo "$1" | sed 's/./=/g')"
}

print_success() {
    echo -e "✅ ${GREEN}$1${NC}"
}

print_error() {
    echo -e "❌ ${RED}$1${NC}"
}

print_warning() {
    echo -e "⚠️  ${YELLOW}$1${NC}"
}

print_info() {
    echo -e "ℹ️  ${CYAN}$1${NC}"
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "Must be run from the CRM project root directory"
    exit 1
fi

print_header "🚀 STARTING COMPREHENSIVE ERROR TESTING"

# Check if Node.js and npm are available
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"  
    exit 1
fi

print_success "Node.js and npm are available"

# Start the development server in background if not running
DEV_SERVER_PID=""
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    print_info "Starting development server..."
    npm run dev > /dev/null 2>&1 &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            print_success "Development server started on http://localhost:5173"
            break
        fi
        sleep 1
    done
    
    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        print_error "Failed to start development server"
        [[ ! -z "$DEV_SERVER_PID" ]] && kill $DEV_SERVER_PID 2>/dev/null
        exit 1
    fi
else
    print_success "Development server already running"
fi

print_header "🧪 RUNNING ERROR HANDLING TESTS"

# Create a temporary HTML file to run tests
cat > temp_test_runner.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>CRM Error Testing Runner</title>
</head>
<body>
    <h1>Running CRM Error Tests...</h1>
    <div id="output"></div>
    
    <script>
        // Redirect console output to page
        const outputDiv = document.getElementById('output');
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        
        console.log = function(...args) {
            originalConsoleLog.apply(console, arguments);
            outputDiv.innerHTML += '<div>' + args.join(' ') + '</div>';
        };
        
        console.error = function(...args) {
            originalConsoleError.apply(console, arguments);
            outputDiv.innerHTML += '<div style="color: red;">' + args.join(' ') + '</div>';
        };
    </script>
    
    <!-- Load test modules -->
    <script src="./comprehensive-error-testing.js"></script>
    <script src="./auth-edge-case-testing.js"></script>
    <script src="./business-logic-testing.js"></script>
    <script src="./resilience-testing.js"></script>
    <script src="./error-test-orchestrator.js"></script>
    
    <script>
        // Run tests when page loads
        window.addEventListener('load', async () => {
            try {
                console.log('Starting comprehensive error testing...');
                
                // Wait for modules to load
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                if (typeof window.runComprehensiveErrorTesting === 'function') {
                    await window.runComprehensiveErrorTesting();
                    
                    // Signal completion
                    document.title = 'TESTING_COMPLETE';
                    
                    // Output results to console for script capture
                    if (window.errorTestResults) {
                        const results = window.errorTestResults;
                        const report = results.errorTracker.getCriticalReport();
                        
                        console.log('\n=== FINAL TEST RESULTS ===');
                        console.log('Total Tests:', results.totalTests);
                        console.log('Critical Issues:', results.criticalIssues);
                        console.log('Standard Errors:', report.errors.length);
                        console.log('Production Ready:', results.criticalIssues === 0 ? 'YES' : 'NO');
                        
                        // Export detailed results
                        window.detailedResults = {
                            summary: {
                                totalTests: results.totalTests,
                                criticalIssues: results.criticalIssues,
                                standardErrors: report.errors.length,
                                productionReady: results.criticalIssues === 0
                            },
                            critical: report.critical,
                            errors: report.errors,
                            recommendations: results.recommendations
                        };
                    }
                    
                } else {
                    console.error('Test orchestrator not available');
                    document.title = 'TESTING_FAILED';
                }
                
            } catch (error) {
                console.error('Test execution failed:', error);
                document.title = 'TESTING_FAILED';
            }
        });
    </script>
</body>
</html>
EOF

print_info "Running comprehensive error tests..."

# Try to run tests with a headless browser if available
if command -v google-chrome &> /dev/null || command -v chromium &> /dev/null; then
    # Use headless Chrome
    CHROME_CMD="google-chrome"
    if ! command -v google-chrome &> /dev/null; then
        CHROME_CMD="chromium"
    fi
    
    print_info "Running tests in headless browser..."
    
    # Start Chrome with the test page
    timeout 120 $CHROME_CMD --headless --disable-gpu --no-sandbox --virtual-time-budget=60000 \
        --run-all-compositor-stages-before-draw --dump-dom "file://$(pwd)/temp_test_runner.html" \
        > browser_output.log 2>&1 || true
        
    # Check browser output for results
    if grep -q "TESTING_COMPLETE" browser_output.log; then
        print_success "Browser tests completed successfully"
        
        # Extract test results
        CRITICAL_ISSUES=$(grep "Critical Issues:" browser_output.log | grep -o '[0-9]*' | tail -1)
        TOTAL_TESTS=$(grep "Total Tests:" browser_output.log | grep -o '[0-9]*' | tail -1)
        PRODUCTION_READY=$(grep "Production Ready:" browser_output.log | grep -o 'YES\|NO' | tail -1)
        
        echo ""
        print_header "📊 TEST RESULTS SUMMARY"
        echo "Total Tests Run: ${TOTAL_TESTS:-Unknown}"
        echo "Critical Issues: ${CRITICAL_ISSUES:-Unknown}"
        echo "Production Ready: ${PRODUCTION_READY:-Unknown}"
        
        if [[ "$PRODUCTION_READY" == "YES" ]]; then
            print_success "🎉 CRM is PRODUCTION READY!"
        else
            print_error "🚨 CRM is NOT READY for production"
            print_warning "Critical issues must be fixed before deployment"
        fi
        
    else
        print_error "Browser tests failed or timed out"
        print_info "Check browser_output.log for details"
    fi
    
else
    print_warning "No headless browser available - manual testing required"
    print_info "Open http://localhost:5173/error-testing-dashboard.html in a browser to run tests manually"
fi

print_header "🎯 WHAT WAS TESTED"
echo "1. Network Failures & Poor Connectivity"
echo "   - 3G/poor WiFi simulation"
echo "   - Connection timeouts"
echo "   - Database disconnections"
echo "   - Network recovery scenarios"
echo ""

echo "2. Data Validation Edge Cases"
echo "   - Invalid emails and phone numbers"
echo "   - Extreme numeric values"
echo "   - Special characters and Unicode"
echo "   - Security vulnerabilities (XSS, SQL injection)"
echo ""

echo "3. User Input Extremes"
echo "   - Rapid clicking (click spam)"
echo "   - Large file uploads"
echo "   - Concurrent editing scenarios"
echo "   - Multiple browser tabs"
echo ""

echo "4. Authentication Edge Cases"
echo "   - Session expiration during workflows"
echo "   - Invalid/corrupted tokens"
echo "   - Multi-device login conflicts"
echo "   - Password security edge cases"
echo ""

echo "5. Business Logic Failures"
echo "   - Estimate calculation errors"
echo "   - Invoice generation issues"
echo "   - Pipeline transition edge cases"
echo "   - Insurance workflow problems"
echo ""

echo "6. Resilience & Recovery"
echo "   - Service outage handling"
echo "   - Graceful degradation"
echo "   - Data corruption recovery"
echo "   - Cascading failure prevention"
echo ""

print_header "🏗️ CONTRACTOR-SPECIFIC SCENARIOS"
echo "✓ Storm season emergency response"
echo "✓ Field crew connectivity issues"
echo "✓ High-volume claim processing"
echo "✓ Equipment failures in harsh weather"
echo "✓ Touch interface with work gloves"
echo "✓ Memory constraints on field devices"
echo ""

print_header "📋 NEXT STEPS"

if [[ "$PRODUCTION_READY" == "YES" ]]; then
    print_success "Your CRM passed comprehensive error testing!"
    echo "• All critical workflows are resilient"
    echo "• Error handling meets production standards"  
    echo "• Ready for contractor field deployment"
    echo ""
    print_info "Consider:"
    echo "• Regular error monitoring in production"
    echo "• Performance monitoring under load"
    echo "• User training on error recovery procedures"
    
elif [[ "$PRODUCTION_READY" == "NO" ]]; then
    print_error "Critical issues found - fix before production"
    echo "• Address all critical failures immediately"
    echo "• Implement proper error handling"
    echo "• Add user feedback for failures"
    echo "• Test network resilience thoroughly"
    echo ""
    print_info "Recommended timeline:"
    echo "• Fix critical issues: 1-2 weeks"
    echo "• Improve error handling: 2-3 weeks"  
    echo "• Re-run full test suite: 1 day"
    
else
    print_warning "Unable to determine production readiness"
    echo "• Run tests manually via dashboard"
    echo "• Check for JavaScript errors"
    echo "• Ensure all test modules loaded correctly"
fi

echo ""
print_header "📊 DETAILED ANALYSIS"
echo "View comprehensive results at:"
echo "• Dashboard: http://localhost:5173/error-testing-dashboard.html"
echo "• Browser console: Check for detailed error logs"
echo "• Log files: Check browser_output.log"
echo ""

print_header "🔧 TROUBLESHOOTING"
echo "If tests failed to run:"
echo "• Ensure development server is running (npm run dev)"
echo "• Check browser console for JavaScript errors"
echo "• Verify all test script files are present"
echo "• Try running tests manually in browser"
echo ""

# Cleanup
cleanup() {
    print_info "Cleaning up..."
    [[ -f "temp_test_runner.html" ]] && rm -f temp_test_runner.html
    [[ ! -z "$DEV_SERVER_PID" ]] && kill $DEV_SERVER_PID 2>/dev/null || true
}

# Set trap to cleanup on script exit
trap cleanup EXIT

print_header "✨ ERROR TESTING COMPLETE"
echo "Generated: $(date)"
echo "Report saved to: browser_output.log"
echo ""

if [[ "$PRODUCTION_READY" == "YES" ]]; then
    print_success "🎉 READY FOR PRODUCTION DEPLOYMENT!"
    exit 0
elif [[ "$PRODUCTION_READY" == "NO" ]]; then
    print_error "🚨 NOT READY - Critical issues found"
    exit 1
else
    print_warning "⚠️ Manual verification required"
    exit 2
fi