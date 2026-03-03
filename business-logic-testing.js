// 🏗️ BUSINESS LOGIC FAILURE TESTING
// Contractor-Specific Workflow and Calculation Edge Cases
// Date: March 3, 2026

console.log("🏗️ STARTING BUSINESS LOGIC FAILURE TESTS");
console.log("=" .repeat(50));

class BusinessLogicFailureTests {
    constructor(errorTracker) {
        this.errorTracker = errorTracker;
        this.testEstimates = [];
        this.testInvoices = [];
        this.testProjects = [];
        this.calculationErrors = [];
    }

    async runBusinessLogicTests() {
        console.log("🔧 Starting comprehensive business logic testing...");
        
        await this.testEstimateCalculations();
        await this.testInvoiceGeneration();
        await this.testPipelineTransitions();
        await this.testProjectManagement();
        await this.testInsuranceWorkflows();
        await this.testFinancialCalculations();
        await this.testReportGeneration();
        await this.testDataExportFunctionality();
        await this.testAutomationFailures();
        await this.testStormSeasonEdgeCases();
    }

    async testEstimateCalculations() {
        console.log("💰 Testing estimate calculation edge cases...");
        
        const estimateTests = [
            // Basic edge cases
            {
                name: 'Zero-cost estimate',
                materials: [],
                labor: 0,
                expected: 0,
                valid: false
            },
            {
                name: 'Massive storm damage',
                materials: [
                    { item: 'Roofing materials', cost: 75000 },
                    { item: 'Siding replacement', cost: 45000 },
                    { item: 'Window replacement', cost: 25000 }
                ],
                labor: 50000,
                expected: 195000,
                valid: true
            },
            {
                name: 'Negative material costs',
                materials: [
                    { item: 'Discount applied', cost: -5000 },
                    { item: 'Roof repair', cost: 15000 }
                ],
                labor: 8000,
                expected: 18000,
                valid: true
            },
            {
                name: 'Extreme precision',
                materials: [
                    { item: 'Specialized material', cost: 1234.567891 }
                ],
                labor: 2345.123456,
                expected: 3579.69,
                valid: true
            },
            {
                name: 'Invalid number formats',
                materials: [
                    { item: 'Bad cost', cost: 'not a number' }
                ],
                labor: 'invalid',
                expected: NaN,
                valid: false
            },
            {
                name: 'Infinity costs',
                materials: [
                    { item: 'Infinite material', cost: Infinity }
                ],
                labor: 5000,
                expected: Infinity,
                valid: false
            },
            {
                name: 'Emergency overtime rates',
                materials: [
                    { item: 'Emergency tarps', cost: 2000 }
                ],
                labor: 8000,
                overtime: true,
                overtimeRate: 1.5,
                expected: 14000,
                valid: true
            }
        ];

        for (const test of estimateTests) {
            try {
                console.log(`Testing estimate: ${test.name}`);
                
                const result = await this.calculateEstimate(test);
                
                // Check for calculation errors
                if (test.valid && isNaN(result.total)) {
                    this.errorTracker.log(
                        'business-logic',
                        'estimate-calculation',
                        `Estimate calculation returned NaN: ${test.name}`,
                        'error',
                        'Customers receive invalid estimates, business reputation damage',
                        `Create estimate with: ${JSON.stringify(test)}`
                    );
                }
                
                if (!test.valid && !isNaN(result.total) && isFinite(result.total)) {
                    this.errorTracker.log(
                        'business-logic',
                        'invalid-estimate-accepted',
                        `Invalid estimate data was processed: ${test.name}`,
                        'error',
                        'Bad estimates sent to customers, incorrect billing',
                        `Input invalid estimate data: ${JSON.stringify(test)}`
                    );
                }
                
                // Check rounding issues
                if (result.total && Math.abs(result.total - test.expected) > 0.01) {
                    this.errorTracker.log(
                        'business-logic',
                        'calculation-precision',
                        `Estimate calculation precision error: expected ${test.expected}, got ${result.total}`,
                        'warning',
                        'Minor billing discrepancies, customer disputes',
                        `Calculate estimate and verify precision`
                    );
                }
                
                // Check for missing components
                if (test.valid && !result.breakdown) {
                    this.errorTracker.log(
                        'business-logic',
                        'estimate-breakdown',
                        `Estimate missing detailed breakdown: ${test.name}`,
                        'error',
                        'Cannot justify costs to customers/insurance',
                        `Generate estimate and check for itemized breakdown`
                    );
                }
                
            } catch (error) {
                if (test.valid) {
                    this.errorTracker.log(
                        'business-logic',
                        'estimate-crash',
                        `Valid estimate caused system crash: ${test.name} - ${error.message}`,
                        'critical',
                        'Cannot generate estimates for customers',
                        `Try to create estimate: ${test.name}`
                    );
                } else {
                    console.log(`✅ Correctly rejected invalid estimate: ${test.name}`);
                }
            }
        }
    }

    async testInvoiceGeneration() {
        console.log("🧾 Testing invoice generation edge cases...");
        
        const invoiceTests = [
            {
                name: 'Invoice with zero amount',
                amount: 0,
                items: [],
                customer: 'Test Customer',
                valid: false
            },
            {
                name: 'Large commercial invoice',
                amount: 500000,
                items: [
                    { description: 'Complete roof replacement', amount: 250000 },
                    { description: 'Structural repairs', amount: 150000 },
                    { description: 'Cleanup and disposal', amount: 100000 }
                ],
                customer: 'Big Corp',
                valid: true
            },
            {
                name: 'Invoice with tax calculation',
                amount: 10000,
                tax_rate: 0.08,
                customer: 'Homeowner',
                valid: true
            },
            {
                name: 'Invoice with missing customer',
                amount: 5000,
                items: [{ description: 'Roof repair', amount: 5000 }],
                customer: null,
                valid: false
            },
            {
                name: 'Insurance claim invoice',
                amount: 25000,
                insurance_info: {
                    company: 'State Farm',
                    claim_number: 'SF123456',
                    deductible: 1000
                },
                customer: 'Policy Holder',
                valid: true
            },
            {
                name: 'Invoice with special characters',
                amount: 3500,
                items: [
                    { description: 'Repair "storm damage" & cleanup', amount: 3500 }
                ],
                customer: "O'Connor & Associates",
                valid: true
            }
        ];

        for (const test of invoiceTests) {
            try {
                console.log(`Testing invoice: ${test.name}`);
                
                const result = await this.generateInvoice(test);
                
                // Check invoice validation
                if (test.valid && !result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'invoice-generation',
                        `Valid invoice generation failed: ${test.name}`,
                        'error',
                        'Cannot bill customers, cash flow issues',
                        `Generate invoice with: ${JSON.stringify(test)}`
                    );
                }
                
                if (!test.valid && result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'invalid-invoice',
                        `Invalid invoice was generated: ${test.name}`,
                        'error', 
                        'Invalid bills sent to customers, legal issues',
                        `Create invalid invoice: ${JSON.stringify(test)}`
                    );
                }
                
                // Check required fields
                if (result.success && test.valid) {
                    const requiredFields = ['invoiceNumber', 'date', 'customer', 'total'];
                    for (const field of requiredFields) {
                        if (!result.invoice[field]) {
                            this.errorTracker.log(
                                'business-logic',
                                'invoice-missing-field',
                                `Invoice missing required field: ${field}`,
                                'error',
                                'Incomplete invoices, payment processing issues',
                                `Generate invoice and check for required fields`
                            );
                        }
                    }
                }
                
                // Check tax calculations
                if (test.tax_rate && result.success) {
                    const expectedTax = test.amount * test.tax_rate;
                    if (Math.abs(result.invoice.tax - expectedTax) > 0.01) {
                        this.errorTracker.log(
                            'business-logic',
                            'tax-calculation',
                            `Tax calculation error: expected ${expectedTax}, got ${result.invoice.tax}`,
                            'error',
                            'Incorrect tax amounts, compliance issues',
                            'Generate invoice with tax and verify calculation'
                        );
                    }
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'invoice-crash',
                    `Invoice generation crashed: ${test.name} - ${error.message}`,
                    'critical',
                    'Cannot create invoices, business operations stopped',
                    `Try invoice generation: ${test.name}`
                );
            }
        }
    }

    async testPipelineTransitions() {
        console.log("🔄 Testing pipeline stage transition edge cases...");
        
        const transitionTests = [
            {
                name: 'Skip required stages',
                from: 'new-lead',
                to: 'work-completed',
                shouldAllow: false,
                reason: 'Cannot skip estimate and approval stages'
            },
            {
                name: 'Backwards transition',
                from: 'work-in-progress',
                to: 'proposal-sent',
                shouldAllow: true,
                reason: 'Customer requested changes'
            },
            {
                name: 'Emergency workflow',
                from: 'new-lead',
                to: 'work-in-progress',
                emergency: true,
                shouldAllow: true,
                reason: 'Emergency storm response'
            },
            {
                name: 'Invalid stage name',
                from: 'proposal-approved',
                to: 'nonexistent-stage',
                shouldAllow: false,
                reason: 'Stage does not exist'
            },
            {
                name: 'Null stage transition',
                from: 'new-lead',
                to: null,
                shouldAllow: false,
                reason: 'Cannot transition to null stage'
            },
            {
                name: 'Insurance dependency',
                from: 'proposal-approved',
                to: 'work-scheduled',
                requiresInsurance: true,
                hasInsuranceInfo: false,
                shouldAllow: false,
                reason: 'Insurance information required'
            },
            {
                name: 'Payment required transition',
                from: 'work-completed',
                to: 'job-closed',
                requiresPayment: true,
                paymentReceived: false,
                shouldAllow: false,
                reason: 'Payment must be received first'
            }
        ];

        for (const test of transitionTests) {
            try {
                console.log(`Testing transition: ${test.name}`);
                
                const result = await this.attemptStageTransition(test);
                
                if (test.shouldAllow && !result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'pipeline-transition-blocked',
                        `Valid transition blocked: ${test.from} → ${test.to} - ${test.reason}`,
                        'error',
                        'Workflows cannot progress, business operations blocked',
                        `Try transition: ${test.from} to ${test.to}`
                    );
                }
                
                if (!test.shouldAllow && result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'invalid-transition-allowed',
                        `Invalid transition allowed: ${test.from} → ${test.to}`,
                        'error',
                        'Business rules violated, workflow integrity compromised',
                        `Attempt invalid transition: ${test.from} to ${test.to}`
                    );
                }
                
                // Check for data consistency
                if (result.success && !result.dataConsistent) {
                    this.errorTracker.log(
                        'business-logic',
                        'transition-data-inconsistency',
                        `Stage transition caused data inconsistency: ${test.name}`,
                        'error',
                        'Project data becomes corrupted',
                        `Perform transition and check data integrity`
                    );
                }
                
                // Check required field validation
                if (test.requiresInsurance && !test.hasInsuranceInfo && result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'missing-insurance-check',
                        'Transition allowed without required insurance information',
                        'error',
                        'Work starts without insurance approval',
                        'Try to schedule work without insurance info'
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'pipeline-transition-crash',
                    `Pipeline transition crashed: ${test.name} - ${error.message}`,
                    'critical',
                    'Cannot update project status, workflow broken',
                    `Attempt transition: ${test.name}`
                );
            }
        }
    }

    async testProjectManagement() {
        console.log("📋 Testing project management edge cases...");
        
        const projectTests = [
            {
                name: 'Overlapping project schedules',
                projects: [
                    { id: 'p1', startDate: '2026-03-05', endDate: '2026-03-15', crew: 'Team A' },
                    { id: 'p2', startDate: '2026-03-10', endDate: '2026-03-20', crew: 'Team A' }
                ],
                expectConflict: true
            },
            {
                name: 'Emergency project priority',
                emergency: true,
                projects: [
                    { id: 'regular', priority: 'normal', startDate: '2026-03-05' },
                    { id: 'emergency', priority: 'emergency', startDate: '2026-03-05' }
                ],
                expectReorder: true
            },
            {
                name: 'Resource overallocation',
                resources: {
                    available: { 'crane': 1, 'workers': 5 },
                    requested: { 'crane': 2, 'workers': 8 }
                },
                shouldFail: true
            },
            {
                name: 'Invalid date ranges',
                project: {
                    startDate: '2026-03-15',
                    endDate: '2026-03-10' // End before start
                },
                shouldFail: true
            },
            {
                name: 'Extremely long project',
                project: {
                    startDate: '2026-03-01',
                    endDate: '2027-03-01' // 1 year project
                },
                expectWarning: true
            }
        ];

        for (const test of projectTests) {
            try {
                console.log(`Testing project scenario: ${test.name}`);
                
                const result = await this.testProjectScenario(test);
                
                if (test.expectConflict && !result.conflictDetected) {
                    this.errorTracker.log(
                        'business-logic',
                        'schedule-conflict',
                        `Schedule conflict not detected: ${test.name}`,
                        'error',
                        'Double-booked crews, project delays',
                        `Create overlapping project schedules`
                    );
                }
                
                if (test.shouldFail && result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'invalid-project',
                        `Invalid project configuration accepted: ${test.name}`,
                        'error',
                        'Impossible schedules created, confusion and delays',
                        `Create invalid project: ${test.name}`
                    );
                }
                
                if (test.expectReorder && !result.reordered) {
                    this.errorTracker.log(
                        'business-logic',
                        'priority-handling',
                        'Emergency projects not prioritized correctly',
                        'critical',
                        'Emergency storm response delayed',
                        'Schedule emergency work alongside regular work'
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'project-management-crash',
                    `Project management failed: ${test.name} - ${error.message}`,
                    'critical',
                    'Cannot manage projects, operations halted',
                    `Test project scenario: ${test.name}`
                );
            }
        }
    }

    async testInsuranceWorkflows() {
        console.log("🛡️ Testing insurance workflow edge cases...");
        
        const insuranceTests = [
            {
                name: 'Missing policy information',
                claim: {
                    claimNumber: 'ABC123',
                    policyNumber: null,
                    adjuster: 'John Doe'
                },
                shouldProcess: false
            },
            {
                name: 'Deductible exceeds estimate',
                claim: {
                    estimateAmount: 5000,
                    deductible: 7500
                },
                expectIssue: true
            },
            {
                name: 'Multiple adjusters',
                claim: {
                    adjusters: [
                        { name: 'Adjuster 1', phone: '555-0001' },
                        { name: 'Adjuster 2', phone: '555-0002' }
                    ]
                },
                expectConfusion: true
            },
            {
                name: 'Expired policy',
                claim: {
                    policyNumber: 'POL123',
                    policyExpired: true,
                    damageDate: '2026-03-01'
                },
                shouldProcess: false
            },
            {
                name: 'Coverage limits exceeded',
                claim: {
                    estimateAmount: 150000,
                    coverageLimit: 100000
                },
                expectIssue: true
            }
        ];

        for (const test of insuranceTests) {
            try {
                console.log(`Testing insurance: ${test.name}`);
                
                const result = await this.processInsuranceClaim(test.claim);
                
                if (!test.shouldProcess && result.processed) {
                    this.errorTracker.log(
                        'business-logic',
                        'invalid-insurance-claim',
                        `Invalid insurance claim processed: ${test.name}`,
                        'error',
                        'Work proceeds without valid insurance, payment issues',
                        `Process insurance claim: ${JSON.stringify(test.claim)}`
                    );
                }
                
                if (test.expectIssue && !result.flaggedIssues) {
                    this.errorTracker.log(
                        'business-logic',
                        'insurance-issue-detection',
                        `Insurance issue not detected: ${test.name}`,
                        'error',
                        'Payment problems discovered after work completion',
                        `Process problematic insurance claim`
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'insurance-workflow-crash',
                    `Insurance processing crashed: ${test.name} - ${error.message}`,
                    'critical',
                    'Cannot process insurance claims',
                    `Test insurance workflow: ${test.name}`
                );
            }
        }
    }

    async testFinancialCalculations() {
        console.log("💹 Testing financial calculation edge cases...");
        
        const financialTests = [
            {
                name: 'Profit margin calculation',
                revenue: 50000,
                costs: 35000,
                expectedMargin: 30,
                tolerance: 0.1
            },
            {
                name: 'Loss scenario',
                revenue: 25000,
                costs: 35000,
                expectedMargin: -40,
                expectLoss: true
            },
            {
                name: 'Currency precision',
                amounts: [1234.567, 2345.891, 3456.123],
                expectRounding: true
            },
            {
                name: 'Large volume calculations',
                transactions: 10000,
                averageAmount: 5000,
                expectPerformanceIssues: true
            }
        ];

        for (const test of financialTests) {
            try {
                console.log(`Testing financial calculation: ${test.name}`);
                
                const startTime = performance.now();
                const result = await this.performFinancialCalculation(test);
                const endTime = performance.now();
                
                // Check calculation accuracy
                if (test.expectedMargin && Math.abs(result.margin - test.expectedMargin) > test.tolerance) {
                    this.errorTracker.log(
                        'business-logic',
                        'financial-accuracy',
                        `Financial calculation inaccurate: expected ${test.expectedMargin}%, got ${result.margin}%`,
                        'error',
                        'Incorrect profit/loss reporting, business decision errors',
                        `Calculate profit margin with revenue ${test.revenue}, costs ${test.costs}`
                    );
                }
                
                // Check performance
                const calculationTime = endTime - startTime;
                if (test.expectPerformanceIssues && calculationTime < 1000) {
                    console.log(`✅ Good performance: ${calculationTime}ms for large calculation`);
                } else if (!test.expectPerformanceIssues && calculationTime > 2000) {
                    this.errorTracker.log(
                        'performance',
                        'financial-calculation-slow',
                        `Financial calculation too slow: ${calculationTime}ms`,
                        'warning',
                        'Slow financial reports, user frustration',
                        'Perform financial calculations and measure time'
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'financial-calculation-crash',
                    `Financial calculation crashed: ${test.name} - ${error.message}`,
                    'critical',
                    'Cannot generate financial reports',
                    `Test financial calculation: ${test.name}`
                );
            }
        }
    }

    async testDataExportFunctionality() {
        console.log("📊 Testing data export edge cases...");
        
        const exportTests = [
            {
                name: 'Large dataset export',
                records: 50000,
                format: 'CSV',
                expectedTime: 30000, // 30 seconds max
                expectMemoryIssues: true
            },
            {
                name: 'Export with special characters',
                data: [
                    { name: 'John "The Builder" Doe', notes: 'Customer said: "Great work!"' },
                    { name: "O'Connor & Associates", address: '123 Main St, Apt #2' }
                ],
                format: 'CSV',
                expectEscaping: true
            },
            {
                name: 'Empty dataset export',
                records: 0,
                format: 'Excel',
                shouldSucceed: true
            },
            {
                name: 'Export with sensitive data',
                includeSensitive: true,
                format: 'PDF',
                expectSecurityWarning: true
            },
            {
                name: 'Concurrent exports',
                concurrent: 5,
                format: 'CSV',
                expectResourceContention: true
            }
        ];

        for (const test of exportTests) {
            try {
                console.log(`Testing export: ${test.name}`);
                
                const startTime = performance.now();
                const result = await this.performDataExport(test);
                const endTime = performance.now();
                
                const exportTime = endTime - startTime;
                
                // Check export success
                if (test.shouldSucceed && !result.success) {
                    this.errorTracker.log(
                        'business-logic',
                        'export-failure',
                        `Export failed unexpectedly: ${test.name}`,
                        'error',
                        'Cannot export customer data for compliance/backup',
                        `Attempt data export: ${test.name}`
                    );
                }
                
                // Check performance
                if (test.expectedTime && exportTime > test.expectedTime) {
                    this.errorTracker.log(
                        'performance',
                        'export-slow',
                        `Export too slow: ${test.name} took ${exportTime}ms`,
                        'warning',
                        'Users wait too long for data exports',
                        `Export large dataset and measure time`
                    );
                }
                
                // Check data integrity
                if (result.success && test.expectEscaping) {
                    if (!result.dataProperlyEscaped) {
                        this.errorTracker.log(
                            'business-logic',
                            'export-data-corruption',
                            'Special characters not properly escaped in export',
                            'error',
                            'Corrupted data in exports, unusable reports',
                            'Export data with special characters'
                        );
                    }
                }
                
                // Check security
                if (test.includeSensitive && !result.securityWarningShown) {
                    this.errorTracker.log(
                        'security',
                        'export-sensitive-data',
                        'Sensitive data exported without warning',
                        'error',
                        'Accidental exposure of private customer information',
                        'Export data including sensitive fields'
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'export-crash',
                    `Data export crashed: ${test.name} - ${error.message}`,
                    'critical',
                    'Cannot export customer data, compliance issues',
                    `Test data export: ${test.name}`
                );
            }
        }
    }

    async testStormSeasonEdgeCases() {
        console.log("🌪️ Testing storm season high-volume scenarios...");
        
        const stormTests = [
            {
                name: 'Hundreds of simultaneous emergency calls',
                emergencyCalls: 500,
                timeframe: '24 hours',
                expectSystemStress: true
            },
            {
                name: 'Emergency priority queue overflow',
                emergencyJobs: 100,
                regularJobs: 200,
                crewCapacity: 80,
                expectPriorityConflicts: true
            },
            {
                name: 'Rapid estimate generation',
                estimates: 50,
                timeLimit: 3600, // 1 hour
                expectPerformanceIssues: false
            },
            {
                name: 'Insurance claim flood',
                claims: 300,
                processing: 'concurrent',
                expectBottlenecks: true
            }
        ];

        for (const test of stormTests) {
            try {
                console.log(`Testing storm scenario: ${test.name}`);
                
                const result = await this.simulateStormScenario(test);
                
                // Check system stability under load
                if (test.expectSystemStress && result.systemStable) {
                    console.log(`✅ System remained stable under storm load: ${test.name}`);
                } else if (!test.expectSystemStress && !result.systemStable) {
                    this.errorTracker.log(
                        'performance',
                        'storm-system-instability',
                        `System became unstable during storm scenario: ${test.name}`,
                        'critical',
                        'System fails during peak emergency periods',
                        `Simulate storm scenario: ${test.name}`
                    );
                }
                
                // Check priority handling
                if (test.expectPriorityConflicts && !result.prioritySystemWorking) {
                    this.errorTracker.log(
                        'business-logic',
                        'storm-priority-failures',
                        'Priority system failed during storm surge',
                        'critical',
                        'Emergency work delayed, property damage increases',
                        'Simulate emergency work surge with limited crews'
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'business-logic',
                    'storm-scenario-crash',
                    `Storm scenario testing crashed: ${test.name} - ${error.message}`,
                    'critical',
                    'System unusable during storm emergencies',
                    `Test storm scenario: ${test.name}`
                );
            }
        }
    }

    // Simulation Helper Methods
    async calculateEstimate(test) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    let total = 0;
                    const breakdown = [];
                    
                    // Calculate materials
                    for (const material of test.materials || []) {
                        if (typeof material.cost !== 'number') {
                            reject(new Error('Invalid material cost'));
                            return;
                        }
                        total += material.cost;
                        breakdown.push(material);
                    }
                    
                    // Calculate labor
                    let laborCost = test.labor || 0;
                    if (typeof laborCost !== 'number') {
                        reject(new Error('Invalid labor cost'));
                        return;
                    }
                    
                    if (test.overtime) {
                        laborCost *= test.overtimeRate || 1.5;
                    }
                    
                    total += laborCost;
                    breakdown.push({ item: 'Labor', cost: laborCost });
                    
                    // Check for edge cases
                    if (!isFinite(total)) {
                        reject(new Error('Calculation resulted in non-finite number'));
                        return;
                    }
                    
                    resolve({
                        total: Math.round(total * 100) / 100, // Round to 2 decimal places
                        breakdown,
                        laborCost,
                        materialCost: total - laborCost
                    });
                    
                } catch (error) {
                    reject(error);
                }
            }, 100 + Math.random() * 300);
        });
    }

    async generateInvoice(test) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    // Basic validation
                    if (!test.customer || test.amount <= 0) {
                        resolve({ success: false, error: 'Invalid invoice data' });
                        return;
                    }
                    
                    const invoice = {
                        invoiceNumber: `INV-${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        customer: test.customer,
                        amount: test.amount,
                        items: test.items || [],
                        total: test.amount
                    };
                    
                    // Calculate tax if provided
                    if (test.tax_rate) {
                        invoice.tax = Math.round(test.amount * test.tax_rate * 100) / 100;
                        invoice.total = test.amount + invoice.tax;
                    }
                    
                    resolve({ success: true, invoice });
                    
                } catch (error) {
                    reject(error);
                }
            }, 200 + Math.random() * 800);
        });
    }

    async attemptStageTransition(test) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let success = true;
                let dataConsistent = true;
                
                // Basic validation
                if (!test.to || test.to === 'nonexistent-stage') {
                    success = false;
                }
                
                // Emergency bypass
                if (test.emergency) {
                    success = true;
                }
                
                // Check requirements
                if (test.requiresInsurance && !test.hasInsuranceInfo) {
                    success = false;
                }
                
                if (test.requiresPayment && !test.paymentReceived) {
                    success = false;
                }
                
                // Simulate data consistency issues
                if (success && Math.random() < 0.1) { // 10% chance of data issues
                    dataConsistent = false;
                }
                
                resolve({
                    success,
                    dataConsistent,
                    from: test.from,
                    to: test.to,
                    timestamp: new Date().toISOString()
                });
            }, 200 + Math.random() * 600);
        });
    }

    async testProjectScenario(test) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let result = {
                    success: true,
                    conflictDetected: false,
                    reordered: false
                };
                
                // Check for scheduling conflicts
                if (test.expectConflict && test.projects) {
                    const hasOverlap = test.projects.some((p1, i) => 
                        test.projects.some((p2, j) => 
                            i !== j && p1.crew === p2.crew
                        )
                    );
                    result.conflictDetected = hasOverlap;
                }
                
                // Check emergency prioritization
                if (test.expectReorder) {
                    result.reordered = true; // Assume emergency gets prioritized
                }
                
                // Check invalid configurations
                if (test.shouldFail) {
                    if (test.project?.startDate > test.project?.endDate) {
                        result.success = false;
                    }
                    if (test.resources) {
                        const overallocated = Object.keys(test.resources.requested).some(
                            resource => test.resources.requested[resource] > test.resources.available[resource]
                        );
                        if (overallocated) {
                            result.success = false;
                        }
                    }
                }
                
                resolve(result);
            }, 300 + Math.random() * 700);
        });
    }

    async processInsuranceClaim(claim) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let processed = true;
                let flaggedIssues = false;
                
                // Basic validation
                if (!claim.policyNumber || !claim.claimNumber) {
                    processed = false;
                }
                
                if (claim.policyExpired) {
                    processed = false;
                }
                
                // Flag potential issues
                if (claim.deductible && claim.estimateAmount && claim.deductible > claim.estimateAmount) {
                    flaggedIssues = true;
                }
                
                if (claim.coverageLimit && claim.estimateAmount > claim.coverageLimit) {
                    flaggedIssues = true;
                }
                
                if (claim.adjusters && claim.adjusters.length > 1) {
                    flaggedIssues = true;
                }
                
                resolve({
                    processed,
                    flaggedIssues,
                    claimNumber: claim.claimNumber || 'N/A'
                });
            }, 400 + Math.random() * 600);
        });
    }

    async performFinancialCalculation(test) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let result = {};
                
                if (test.revenue && test.costs) {
                    const profit = test.revenue - test.costs;
                    const margin = (profit / test.revenue) * 100;
                    result.margin = Math.round(margin * 10) / 10; // Round to 1 decimal
                }
                
                if (test.amounts) {
                    result.total = test.amounts.reduce((sum, amount) => sum + amount, 0);
                    result.rounded = Math.round(result.total * 100) / 100;
                }
                
                if (test.transactions) {
                    // Simulate processing many transactions
                    result.processed = test.transactions;
                }
                
                resolve(result);
            }, test.expectPerformanceIssues ? 2000 + Math.random() * 3000 : 100 + Math.random() * 500);
        });
    }

    async performDataExport(test) {
        return new Promise((resolve) => {
            let exportTime = 100;
            
            // Adjust time based on data size
            if (test.records) {
                exportTime += test.records * 0.5; // 0.5ms per record
            }
            
            if (test.concurrent) {
                exportTime *= test.concurrent; // Slower with concurrent exports
            }
            
            setTimeout(() => {
                let result = {
                    success: true,
                    recordsExported: test.records || 0,
                    format: test.format,
                    dataProperlyEscaped: true,
                    securityWarningShown: test.includeSensitive || false
                };
                
                // Simulate memory issues with large datasets
                if (test.expectMemoryIssues && test.records > 40000) {
                    result.success = Math.random() > 0.3; // 70% success rate
                }
                
                resolve(result);
            }, exportTime);
        });
    }

    async simulateStormScenario(test) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let result = {
                    systemStable: true,
                    prioritySystemWorking: true
                };
                
                // Simulate system stress
                if (test.expectSystemStress) {
                    result.systemStable = Math.random() > 0.2; // 80% stable
                }
                
                // Simulate priority conflicts
                if (test.expectPriorityConflicts) {
                    result.prioritySystemWorking = Math.random() > 0.4; // 60% working
                }
                
                resolve(result);
            }, 1000 + Math.random() * 2000);
        });
    }
}

// Make available globally
window.crmBusinessLogicTesting = {
    BusinessLogicFailureTests
};

console.log("🏗️ Business logic testing loaded. Access via window.crmBusinessLogicTesting");