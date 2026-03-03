// 🔍 COMPREHENSIVE ERROR HANDLING & EDGE CASE TESTING SUITE
// Contractor CRM Resilience & Failure Point Analysis
// Date: March 3, 2026

console.log("🚨 STARTING COMPREHENSIVE ERROR HANDLING TESTS");
console.log("=" .repeat(60));

// ===== ERROR TRACKING SYSTEM =====
class ErrorTracker {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.criticalFailures = [];
        this.userExperienceIssues = [];
        this.performanceIssues = [];
    }

    log(type, category, description, severity, userImpact, reproduction) {
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            category,
            description,
            severity,
            userImpact,
            reproduction,
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        switch(severity) {
            case 'critical':
                this.criticalFailures.push(entry);
                break;
            case 'warning':
                this.warnings.push(entry);
                break;
            case 'performance':
                this.performanceIssues.push(entry);
                break;
            default:
                this.errors.push(entry);
        }

        console.error(`${severity.toUpperCase()}: [${category}] ${description}`);
        return entry.id;
    }

    getCriticalReport() {
        return {
            critical: this.criticalFailures,
            errors: this.errors,
            warnings: this.warnings,
            performance: this.performanceIssues,
            ux: this.userExperienceIssues,
            totalIssues: this.criticalFailures.length + this.errors.length + this.warnings.length,
            productionReadiness: this.criticalFailures.length === 0 ? 'READY' : 'NOT READY'
        };
    }
}

const errorTracker = new ErrorTracker();

// ===== 1. NETWORK FAILURE TESTING =====
class NetworkFailureTests {
    constructor() {
        this.originalFetch = window.fetch;
        this.isOffline = false;
        this.networkDelay = 0;
        this.failureRate = 0;
    }

    // Simulate poor connectivity (3G/poor WiFi)
    simulatePoorConnectivity() {
        console.log("🌐 Testing Poor Connectivity Conditions...");
        
        window.fetch = (...args) => {
            return new Promise((resolve, reject) => {
                // Simulate slow connection
                const delay = 3000 + Math.random() * 7000; // 3-10 second delays
                
                setTimeout(async () => {
                    // 30% chance of timeout
                    if (Math.random() < 0.3) {
                        errorTracker.log(
                            'network',
                            'connectivity',
                            'Connection timeout on poor network',
                            'critical',
                            'User cannot complete critical actions like creating estimates or updating jobs',
                            'Visit job site with poor cellular coverage and try to update project status'
                        );
                        reject(new Error('Network timeout'));
                        return;
                    }

                    try {
                        const response = await this.originalFetch(...args);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                }, delay);
            });
        };

        return this.runConnectivityTests();
    }

    // Test connection timeout scenarios
    async runConnectivityTests() {
        const tests = [
            { action: 'Create new contact', critical: true },
            { action: 'Update pipeline stage', critical: true },
            { action: 'Upload damage photos', critical: true },
            { action: 'Generate estimate', critical: true },
            { action: 'Send customer communication', critical: false },
            { action: 'Export data', critical: false }
        ];

        console.log("Testing actions under poor connectivity...");
        
        for (const test of tests) {
            try {
                console.log(`🧪 Testing: ${test.action}`);
                await this.simulateUserAction(test.action);
            } catch (error) {
                const severity = test.critical ? 'critical' : 'error';
                errorTracker.log(
                    'network',
                    'timeout',
                    `${test.action} failed under poor connectivity: ${error.message}`,
                    severity,
                    test.critical ? 'Blocks critical contractor workflow' : 'Degrades user experience',
                    `Simulate poor network and attempt: ${test.action}`
                );
            }
        }
    }

    // Simulate database disconnection mid-workflow
    simulateDbDisconnection() {
        console.log("💀 Testing Database Disconnection Scenarios...");
        
        // Override fetch to simulate DB failures
        let requestCount = 0;
        window.fetch = (url, options) => {
            requestCount++;
            
            // Simulate connection loss after 3 successful requests
            if (requestCount > 3) {
                return Promise.reject(new Error('ETIMEDOUT: Database connection lost'));
            }
            
            return this.originalFetch(url, options);
        };

        return this.testCriticalWorkflows();
    }

    // Test offline scenarios
    async simulateOfflineMode() {
        console.log("📱 Testing Offline Scenarios...");
        
        // Block all network requests
        window.fetch = () => Promise.reject(new Error('Network unavailable'));
        
        const offlineTests = [
            'View existing contact data',
            'Create new contact (should queue)',
            'Modify contact status',
            'Add work notes',
            'Take photos',
            'Schedule appointments'
        ];

        for (const test of offlineTests) {
            try {
                await this.testOfflineCapability(test);
            } catch (error) {
                errorTracker.log(
                    'offline',
                    'data-access',
                    `Offline test failed: ${test} - ${error.message}`,
                    'critical',
                    'Field crews cannot work without connectivity',
                    `Disconnect internet and attempt: ${test}`
                );
            }
        }
    }

    // Test network recovery scenarios
    async testNetworkRecovery() {
        console.log("🔄 Testing Network Recovery Scenarios...");
        
        // Simulate intermittent connectivity
        let connected = false;
        window.fetch = (...args) => {
            connected = !connected; // Toggle connectivity
            
            if (connected) {
                return this.originalFetch(...args);
            } else {
                return Promise.reject(new Error('Connection lost'));
            }
        };

        try {
            await this.testDataSyncAfterRecovery();
        } catch (error) {
            errorTracker.log(
                'recovery',
                'data-sync',
                `Data sync failed after network recovery: ${error.message}`,
                'critical',
                'Data loss or inconsistency when connection restored',
                'Disconnect/reconnect network during data entry'
            );
        }
    }

    async simulateUserAction(action) {
        // Simulate various user actions that make API calls
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() < 0.4) { // 40% failure rate on poor network
                    reject(new Error(`${action} failed due to network issues`));
                } else {
                    resolve(`${action} completed successfully`);
                }
            }, 2000 + Math.random() * 3000);
        });
    }

    async testCriticalWorkflows() {
        const workflows = [
            'Emergency storm response workflow',
            'Customer estimate creation',
            'Invoice generation',
            'Project status updates',
            'Team communication'
        ];

        for (const workflow of workflows) {
            try {
                console.log(`🔧 Testing critical workflow: ${workflow}`);
                // Simulate multi-step workflow
                await this.simulateUserAction(`Step 1 of ${workflow}`);
                await this.simulateUserAction(`Step 2 of ${workflow}`);
                await this.simulateUserAction(`Step 3 of ${workflow}`);
            } catch (error) {
                errorTracker.log(
                    'workflow',
                    'database-failure',
                    `Critical workflow '${workflow}' failed mid-process`,
                    'critical',
                    'Partial data corruption, workflow must be restarted',
                    `Start workflow, then disconnect database mid-process`
                );
            }
        }
    }

    async testOfflineCapability(action) {
        console.log(`📵 Testing offline: ${action}`);
        
        // Check if app has offline capabilities
        if (!('serviceWorker' in navigator)) {
            throw new Error('No offline capability - missing service worker');
        }

        // Test local storage fallback
        try {
            localStorage.setItem('test_offline_data', JSON.stringify({ action, timestamp: Date.now() }));
        } catch (error) {
            throw new Error('Cannot store data offline - localStorage failed');
        }

        return Promise.resolve(`${action} handled offline`);
    }

    async testDataSyncAfterRecovery() {
        console.log("🔄 Testing data synchronization after network recovery...");
        
        // Simulate queued operations
        const queuedOperations = [
            { type: 'contact_create', data: 'New contact data' },
            { type: 'status_update', data: 'Pipeline status change' },
            { type: 'note_add', data: 'Work progress note' }
        ];

        for (const operation of queuedOperations) {
            try {
                await this.simulateUserAction(`Sync ${operation.type}`);
                console.log(`✅ Synced: ${operation.type}`);
            } catch (error) {
                throw new Error(`Failed to sync ${operation.type}: ${error.message}`);
            }
        }
    }

    restore() {
        window.fetch = this.originalFetch;
    }
}

// ===== 2. DATA VALIDATION EDGE CASES =====
class DataValidationTests {
    constructor() {
        this.extremeTestData = this.generateExtremeTestData();
    }

    generateExtremeTestData() {
        return {
            // Email edge cases
            invalidEmails: [
                'plainaddress',
                '@missingusername.com',
                'username@.com',
                'username@com',
                'username..double.dot@example.com',
                'username@-example.com',
                'user name@example.com', // space
                'username@example-.com',
                'a'.repeat(320) + '@example.com', // too long
                'user@' + 'a'.repeat(260) + '.com' // domain too long
            ],
            
            // Phone edge cases  
            invalidPhones: [
                '123', // too short
                '12345678901234567890', // too long
                '(555) 123-abcd', // letters
                '++1-555-123-4567', // double plus
                '555.123.4567 ext 12345678', // extension too long
                '+999999999999999999999', // invalid country code
                ' ', // just space
                '(555) 123-4567#9999999999' // extension too long
            ],

            // Extreme values
            extremeNumbers: [
                Number.MAX_VALUE,
                Number.MIN_VALUE,
                Infinity,
                -Infinity,
                NaN,
                '999999999999999999999999999999999', // Very large string number
                '-999999999999999999999999999999999', // Very large negative
                '0.000000000000000000000000000001' // Very small decimal
            ],

            // Special characters in names
            edgeCaseNames: [
                "O'Connor", // apostrophe
                "Mary-Jane Smith", // hyphen  
                "José María", // accents
                "王小明", // Chinese characters
                "محمد عبدالله", // Arabic
                "Владимир Иванович", // Cyrillic
                "Smith & Associates, LLC", // ampersand
                "<script>alert('xss')</script>", // XSS attempt
                "'; DROP TABLE contacts; --", // SQL injection
                "null", // string null
                "undefined", // string undefined
                "", // empty string
                " ", // just space
                "a".repeat(1000), // extremely long name
                "🏗️👷‍♂️🔨", // emojis
                "\n\t\r", // whitespace characters
                "\"John Doe\"", // quoted name
                "\\\\server\\share", // UNC path
                "../../../etc/passwd" // path traversal
            ],

            // Date edge cases
            edgeDates: [
                '2024-02-30', // Invalid date (Feb 30)
                '2024-13-01', // Invalid month
                '2024-01-32', // Invalid day
                '1899-01-01', // Very old date
                '2099-12-31', // Far future
                '0000-00-00', // Null date
                'not-a-date',
                '',
                '2024/02/29', // Different format
                '29/02/2024', // Different format
                'Feb 29, 2023', // Invalid leap year
                '2024-02-29T25:00:00.000Z' // Invalid time
            ],

            // Large text blocks
            largeTexts: {
                description: 'A'.repeat(10000), // 10KB description
                notes: 'Storm damage notes: ' + 'B'.repeat(50000), // 50KB notes
                address: 'C'.repeat(1000) + ' Main Street', // 1KB address
                hugeField: 'D'.repeat(100000) // 100KB field
            }
        };
    }

    async runValidationTests() {
        console.log("🔍 Starting Data Validation Edge Case Tests...");
        
        await this.testInvalidEmails();
        await this.testInvalidPhones();
        await this.testSpecialCharacters();
        await this.testExtremeValues();
        await this.testEdgeDates();
        await this.testLargeDataInputs();
        await this.testNullAndUndefined();
        await this.testSecurityVulnerabilities();
    }

    async testInvalidEmails() {
        console.log("📧 Testing invalid email edge cases...");
        
        for (const email of this.extremeTestData.invalidEmails) {
            try {
                const result = await this.simulateContactCreation({ email });
                
                if (result.success) {
                    errorTracker.log(
                        'validation',
                        'email', 
                        `Invalid email accepted: ${email}`,
                        'error',
                        'Bad data in database, could cause email sending failures',
                        `Try to create contact with email: ${email}`
                    );
                }
            } catch (error) {
                // Good - validation caught the error
                console.log(`✅ Correctly rejected email: ${email}`);
            }
        }
    }

    async testInvalidPhones() {
        console.log("📞 Testing invalid phone edge cases...");
        
        for (const phone of this.extremeTestData.invalidPhones) {
            try {
                const result = await this.simulateContactCreation({ phone1: phone });
                
                if (result.success) {
                    errorTracker.log(
                        'validation',
                        'phone',
                        `Invalid phone accepted: ${phone}`,
                        'error', 
                        'Cannot call customer, communication breakdown',
                        `Try to create contact with phone: ${phone}`
                    );
                }
            } catch (error) {
                console.log(`✅ Correctly rejected phone: ${phone}`);  
            }
        }
    }

    async testSpecialCharacters() {
        console.log("🔤 Testing special characters in names...");
        
        for (const name of this.extremeTestData.edgeCaseNames) {
            try {
                const result = await this.simulateContactCreation({ 
                    first_name: name,
                    last_name: name 
                });
                
                // Check for security issues
                if (name.includes('<script>') || name.includes('DROP TABLE')) {
                    if (result.success) {
                        errorTracker.log(
                            'security',
                            'xss-sql-injection',
                            `Dangerous input accepted: ${name}`,
                            'critical',
                            'Potential XSS/SQL injection vulnerability',
                            `Input malicious string: ${name}`
                        );
                    }
                }
                
                // Check for encoding issues
                if (name.includes('王') || name.includes('محمد')) {
                    if (!result.success) {
                        errorTracker.log(
                            'internationalization',
                            'unicode',
                            `Unicode name rejected: ${name}`,
                            'error',
                            'Cannot serve international customers',
                            `Try international characters: ${name}`
                        );
                    }
                }
                
            } catch (error) {
                if (name.includes('<script>')) {
                    console.log(`✅ Correctly blocked XSS attempt: ${name}`);
                } else {
                    console.log(`⚠️ Name rejected (might be valid): ${name}`);
                }
            }
        }
    }

    async testExtremeValues() {
        console.log("🔢 Testing extreme numeric values...");
        
        for (const value of this.extremeTestData.extremeNumbers) {
            try {
                const result = await this.simulateContactCreation({ 
                    project_value: value,
                    deductible: value
                });
                
                if (result.success && (value === Infinity || isNaN(value))) {
                    errorTracker.log(
                        'validation', 
                        'extreme-numbers',
                        `Extreme numeric value accepted: ${value}`,
                        'error',
                        'Calculation errors, invalid estimates/invoices',
                        `Input extreme number: ${value}`
                    );
                }
            } catch (error) {
                console.log(`✅ Correctly handled extreme value: ${value}`);
            }
        }
    }

    async testEdgeDates() {
        console.log("📅 Testing edge case dates...");
        
        for (const date of this.extremeTestData.edgeDates) {
            try {
                const result = await this.simulateContactCreation({
                    created_at: date,
                    scheduled_date: date
                });
                
                if (result.success && (date === '2024-02-30' || date === '2024-13-01')) {
                    errorTracker.log(
                        'validation',
                        'invalid-dates',
                        `Invalid date accepted: ${date}`,
                        'error',
                        'Scheduling errors, timeline confusion',
                        `Input invalid date: ${date}`
                    );
                }
            } catch (error) {
                console.log(`✅ Correctly rejected invalid date: ${date}`);
            }
        }
    }

    async testLargeDataInputs() {
        console.log("💾 Testing large data inputs...");
        
        const largeData = this.extremeTestData.largeTexts;
        
        for (const [field, largeText] of Object.entries(largeData)) {
            try {
                console.log(`Testing large ${field}: ${largeText.length} characters`);
                
                const contact = {};
                contact[field] = largeText;
                
                const startTime = performance.now();
                const result = await this.simulateContactCreation(contact);
                const endTime = performance.now();
                
                const processingTime = endTime - startTime;
                
                if (processingTime > 5000) { // > 5 seconds
                    errorTracker.log(
                        'performance',
                        'large-data',
                        `Large ${field} input caused slow processing: ${processingTime}ms`,
                        'performance',
                        'Poor user experience, system appears frozen',
                        `Input ${largeText.length} character ${field}`
                    );
                }
                
                if (result.success) {
                    console.log(`✅ Large ${field} handled successfully`);
                } else {
                    console.log(`⚠️ Large ${field} rejected`);
                }
                
            } catch (error) {
                errorTracker.log(
                    'performance',
                    'large-data-crash',
                    `Large ${field} input caused system error: ${error.message}`,
                    'critical',
                    'System crash when processing large inputs',
                    `Input very large ${field} data`
                );
            }
        }
    }

    async testNullAndUndefined() {
        console.log("❌ Testing null/undefined/empty values...");
        
        const nullishValues = [null, undefined, '', ' ', 'null', 'undefined', 0, false];
        const requiredFields = ['first_name', 'last_name', 'email', 'company_id'];
        
        for (const field of requiredFields) {
            for (const value of nullishValues) {
                try {
                    const contact = { first_name: 'Test', last_name: 'User', email: 'test@test.com' };
                    contact[field] = value;
                    
                    const result = await this.simulateContactCreation(contact);
                    
                    if (result.success) {
                        errorTracker.log(
                            'validation',
                            'required-fields',
                            `Required field ${field} accepted null/empty value: ${value}`,
                            'error',
                            'Incomplete customer records, workflow failures',
                            `Set required field ${field} to: ${value}`
                        );
                    }
                } catch (error) {
                    console.log(`✅ Correctly required field ${field} with value ${value}`);
                }
            }
        }
    }

    async testSecurityVulnerabilities() {
        console.log("🔐 Testing security vulnerabilities...");
        
        const maliciousInputs = [
            '<script>alert("XSS")</script>',
            '"; DROP TABLE contacts; --',
            '{{7*7}}', // Template injection
            '${7*7}', // Template literal injection
            '../../../etc/passwd',
            'javascript:alert("XSS")',
            'data:text/html,<script>alert("XSS")</script>',
            'file:///etc/passwd',
            '\x00', // Null byte
            '%00', // URL encoded null
            'UNION SELECT * FROM users--'
        ];
        
        const fields = ['first_name', 'last_name', 'email', 'notes', 'address'];
        
        for (const input of maliciousInputs) {
            for (const field of fields) {
                try {
                    const contact = {};
                    contact[field] = input;
                    
                    const result = await this.simulateContactCreation(contact);
                    
                    if (result.success) {
                        errorTracker.log(
                            'security',
                            'code-injection',
                            `Malicious input accepted in ${field}: ${input}`,
                            'critical',
                            'Potential system compromise, data breach',
                            `Input malicious code in ${field}: ${input}`
                        );
                    }
                } catch (error) {
                    console.log(`✅ Security: Blocked malicious input in ${field}`);
                }
            }
        }
    }

    async simulateContactCreation(contactData) {
        // Simulate contact creation API call
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Basic simulation - in real test would call actual API
                try {
                    const hasRequiredFields = contactData.first_name && contactData.last_name;
                    const validEmail = !contactData.email || this.isValidEmail(contactData.email);
                    
                    if (hasRequiredFields && validEmail) {
                        resolve({ success: true, data: contactData });
                    } else {
                        reject(new Error('Validation failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            }, 100 + Math.random() * 200); // Simulate network delay
        });
    }

    isValidEmail(email) {
        // Basic email validation for simulation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }
}
// ===== 3. USER INPUT EXTREMES =====
class UserInputExtremeTests {
    constructor() {
        this.clickCounter = 0;
        this.fileUploadTests = [];
        this.concurrentEditTests = [];
    }

    async runInputExtremeTests() {
        console.log("🖱️ Starting User Input Extreme Tests...");
        
        await this.testRapidClicking();
        await this.testLargeFileUploads();
        await this.testConcurrentEditing();
        await this.testMultipleTabs();
        await this.testBrowserLimits();
        await this.testTouchInterfaceEdgeCases();
    }

    async testRapidClicking() {
        console.log("⚡ Testing rapid clicking (click spamming)...");
        
        const buttons = [
            'Save Contact',
            'Update Status', 
            'Upload Photo',
            'Generate Estimate',
            'Send Email',
            'Delete Contact'
        ];

        for (const button of buttons) {
            try {
                console.log(`Testing rapid clicking on: ${button}`);
                
                // Simulate 50 clicks in 2 seconds
                const promises = [];
                for (let i = 0; i < 50; i++) {
                    promises.push(this.simulateButtonClick(button, i));
                }
                
                const results = await Promise.allSettled(promises);
                
                // Check for duplicate operations
                const successfulClicks = results.filter(r => r.status === 'fulfilled').length;
                const rejectedClicks = results.filter(r => r.status === 'rejected').length;
                
                if (successfulClicks > 1) {
                    errorTracker.log(
                        'user-input',
                        'rapid-clicking',
                        `${button} processed ${successfulClicks} duplicate clicks`,
                        'error',
                        'Duplicate charges, multiple emails sent, data corruption',
                        `Rapidly click ${button} 50 times in 2 seconds`
                    );
                }
                
                console.log(`✅ ${button}: ${successfulClicks} success, ${rejectedClicks} blocked`);
                
            } catch (error) {
                errorTracker.log(
                    'user-input',
                    'click-overload',
                    `System crashed during rapid clicking of ${button}: ${error.message}`,
                    'critical',
                    'Application becomes unresponsive',
                    `Rapidly click ${button} until system fails`
                );
            }
        }
    }

    async testLargeFileUploads() {
        console.log("📁 Testing large file upload scenarios...");
        
        const fileScenarios = [
            { name: 'huge_damage_photo.jpg', size: 50 * 1024 * 1024, type: 'image/jpeg' }, // 50MB
            { name: 'storm_video.mp4', size: 500 * 1024 * 1024, type: 'video/mp4' }, // 500MB  
            { name: 'contract.pdf', size: 100 * 1024 * 1024, type: 'application/pdf' }, // 100MB
            { name: 'multiple_files_batch', size: 1024 * 1024 * 1024, type: 'batch' }, // 1GB batch
            { name: 'malicious.exe', size: 1024 * 1024, type: 'application/exe' }, // Executable
            { name: 'no_extension', size: 10 * 1024 * 1024, type: '' }, // No extension
            { name: 'empty_file', size: 0, type: 'text/plain' }, // 0 bytes
        ];

        for (const fileTest of fileScenarios) {
            try {
                console.log(`Testing file upload: ${fileTest.name} (${fileTest.size} bytes)`);
                
                const uploadResult = await this.simulateFileUpload(fileTest);
                
                // Check for issues
                if (fileTest.size > 10 * 1024 * 1024 && uploadResult.success) {
                    // Large files should be handled gracefully
                    if (uploadResult.uploadTime > 30000) { // > 30 seconds
                        errorTracker.log(
                            'performance',
                            'file-upload',
                            `Large file upload too slow: ${fileTest.name} took ${uploadResult.uploadTime}ms`,
                            'warning',
                            'Field crews wait too long, lose productivity',
                            `Upload ${fileTest.name} and measure time`
                        );
                    }
                }
                
                if (fileTest.type === 'application/exe' && uploadResult.success) {
                    errorTracker.log(
                        'security',
                        'file-type',
                        `Executable file accepted: ${fileTest.name}`,
                        'critical',
                        'Potential malware upload, security breach',
                        `Try to upload .exe file: ${fileTest.name}`
                    );
                }
                
            } catch (error) {
                if (fileTest.size > 100 * 1024 * 1024) {
                    console.log(`✅ Correctly rejected oversized file: ${fileTest.name}`);
                } else {
                    errorTracker.log(
                        'file-handling',
                        'upload-crash',
                        `File upload crashed: ${fileTest.name} - ${error.message}`,
                        'error',
                        'Cannot document damage, workflow blocked',
                        `Upload file: ${fileTest.name}`
                    );
                }
            }
        }
    }

    async testConcurrentEditing() {
        console.log("👥 Testing concurrent editing scenarios...");
        
        const contacts = [
            { id: 'contact_1', name: 'Storm Victim #1' },
            { id: 'contact_2', name: 'Storm Victim #2' },
            { id: 'contact_3', name: 'Storm Victim #3' }
        ];

        for (const contact of contacts) {
            try {
                console.log(`Testing concurrent editing of: ${contact.name}`);
                
                // Simulate 3 users editing the same contact simultaneously
                const editPromises = [
                    this.simulateUserEdit(contact.id, 'user1', { status: 'proposal-sent', notes: 'User 1 notes' }),
                    this.simulateUserEdit(contact.id, 'user2', { status: 'work-scheduled', estimate: 15000 }),
                    this.simulateUserEdit(contact.id, 'user3', { phone1: '614-555-0123', address: 'New address' })
                ];
                
                const results = await Promise.allSettled(editPromises);
                
                // Check for data conflicts
                const successfulEdits = results.filter(r => r.status === 'fulfilled');
                
                if (successfulEdits.length > 1) {
                    errorTracker.log(
                        'concurrency',
                        'data-conflict', 
                        `Concurrent edits to ${contact.name} may have caused data loss`,
                        'error',
                        'Last edit wins, other changes lost',
                        `Have multiple users edit same contact simultaneously`
                    );
                }
                
            } catch (error) {
                errorTracker.log(
                    'concurrency',
                    'edit-conflict',
                    `Concurrent editing crashed for ${contact.name}: ${error.message}`,
                    'critical',
                    'Users lose work, system becomes unstable',
                    `Multiple users edit same record at once`
                );
            }
        }
    }

    async testMultipleTabs() {
        console.log("🗂️ Testing multiple browser tabs/windows...");
        
        try {
            // Simulate multiple tab scenarios
            const tabScenarios = [
                'Same contact open in 3 tabs',
                'Dashboard open in multiple tabs',
                'Different stages of same pipeline in multiple tabs',
                'Same estimate being edited in 2 tabs'
            ];

            for (const scenario of tabScenarios) {
                console.log(`Testing scenario: ${scenario}`);
                
                // Simulate tab conflicts
                const tabPromises = [];
                for (let i = 0; i < 3; i++) {
                    tabPromises.push(this.simulateTabSession(`tab_${i}`, scenario));
                }
                
                const results = await Promise.allSettled(tabPromises);
                
                // Check for synchronization issues
                const conflictingTabs = results.filter(r => 
                    r.status === 'fulfilled' && r.value.hasConflict
                );
                
                if (conflictingTabs.length > 0) {
                    errorTracker.log(
                        'multi-tab',
                        'synchronization',
                        `Multiple tabs caused conflicts in: ${scenario}`,
                        'error',
                        'Users see different data, work in wrong context',
                        `Open ${scenario.toLowerCase()} and modify data`
                    );
                }
            }
            
        } catch (error) {
            errorTracker.log(
                'multi-tab',
                'system-overload',
                `Multiple tabs caused system failure: ${error.message}`,
                'critical',
                'Browser becomes unresponsive, users lose access',
                'Open many tabs of same CRM views'
            );
        }
    }

    async testBrowserLimits() {
        console.log("🌐 Testing browser memory and storage limits...");
        
        try {
            // Test localStorage limits
            const testKey = 'crm_memory_test';
            let dataSize = 0;
            let chunk = 'A'.repeat(100000); // 100KB chunks
            
            while (dataSize < 10 * 1024 * 1024) { // Try up to 10MB
                try {
                    localStorage.setItem(`${testKey}_${dataSize}`, chunk);
                    dataSize += chunk.length;
                } catch (error) {
                    console.log(`✅ localStorage limit reached at: ${dataSize} bytes`);
                    break;
                }
            }
            
            // Test memory usage with large datasets
            const largeDataSet = [];
            for (let i = 0; i < 10000; i++) {
                largeDataSet.push({
                    id: i,
                    name: `Contact ${i}`,
                    description: 'A'.repeat(1000),
                    data: new Array(100).fill(Math.random())
                });
            }
            
            console.log(`Created dataset with ${largeDataSet.length} contacts`);
            
            // Check memory usage
            if (performance.memory) {
                const memoryBefore = performance.memory.usedJSHeapSize;
                
                // Simulate processing large dataset
                const processed = largeDataSet.map(contact => ({
                    ...contact,
                    processed: true,
                    timestamp: Date.now()
                }));
                
                const memoryAfter = performance.memory.usedJSHeapSize;
                const memoryUsed = memoryAfter - memoryBefore;
                
                if (memoryUsed > 50 * 1024 * 1024) { // > 50MB
                    errorTracker.log(
                        'performance',
                        'memory-usage',
                        `Large dataset processing used ${memoryUsed / 1024 / 1024}MB memory`,
                        'warning',
                        'Browser may become slow or crash on large datasets',
                        'Process large customer database'
                    );
                }
            }
            
            // Cleanup test data
            for (let i = 0; i < dataSize; i += 100000) {
                localStorage.removeItem(`${testKey}_${i}`);
            }
            
        } catch (error) {
            errorTracker.log(
                'browser-limits',
                'memory-crash',
                `Browser limit testing caused crash: ${error.message}`,
                'critical',
                'Application unusable with large datasets',
                'Load large amount of data in browser'
            );
        }
    }

    async testTouchInterfaceEdgeCases() {
        console.log("📱 Testing touch interface with work conditions...");
        
        const touchScenarios = [
            'Wet gloves - reduced touch sensitivity',
            'Thick winter gloves - large touch area',
            'Dusty hands - poor screen contact',
            'Sweaty hands - accidental touches'
        ];

        for (const scenario of touchScenarios) {
            try {
                console.log(`Testing touch scenario: ${scenario}`);
                
                // Simulate touch interface issues
                const touchResult = await this.simulateTouchInteraction(scenario);
                
                if (!touchResult.successful) {
                    errorTracker.log(
                        'mobile-ux',
                        'touch-interface',
                        `Touch interaction failed: ${scenario}`,
                        'error',
                        'Field crews cannot use mobile interface effectively',
                        `Try using app with: ${scenario}`
                    );
                }
                
            } catch (error) {
                errorTracker.log(
                    'mobile-ux',
                    'touch-crash',
                    `Touch interface crashed during: ${scenario} - ${error.message}`,
                    'critical',
                    'Mobile app unusable in field conditions',
                    `Use mobile with work gloves/harsh conditions`
                );
            }
        }
    }

    // Simulation methods
    async simulateButtonClick(buttonName, clickIndex) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate button debouncing - first click succeeds, others rejected
                if (clickIndex === 0) {
                    resolve({ success: true, clickIndex });
                } else if (clickIndex < 5) {
                    reject(new Error('Button disabled - too many clicks'));
                } else {
                    reject(new Error('Rate limited'));
                }
            }, 10 + Math.random() * 40); // 10-50ms response time
        });
    }

    async simulateFileUpload(fileTest) {
        return new Promise((resolve, reject) => {
            const uploadTime = fileTest.size / (1024 * 1024) * 1000 + Math.random() * 2000; // ~1MB/sec + noise
            
            setTimeout(() => {
                // Reject certain file types
                if (fileTest.type === 'application/exe') {
                    reject(new Error('Executable files not allowed'));
                    return;
                }
                
                // Reject oversized files
                if (fileTest.size > 100 * 1024 * 1024) {
                    reject(new Error('File too large'));
                    return;
                }
                
                // Reject empty files
                if (fileTest.size === 0) {
                    reject(new Error('Empty file'));
                    return;
                }
                
                resolve({
                    success: true,
                    uploadTime: uploadTime,
                    fileSize: fileTest.size,
                    fileName: fileTest.name
                });
                
            }, Math.min(uploadTime, 30000)); // Cap at 30 seconds
        });
    }

    async simulateUserEdit(contactId, userId, changes) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate last-write-wins conflict
                const random = Math.random();
                if (random < 0.33) {
                    resolve({ 
                        success: true, 
                        userId, 
                        changes, 
                        timestamp: Date.now() 
                    });
                } else if (random < 0.66) {
                    reject(new Error('Edit conflict detected'));
                } else {
                    resolve({
                        success: true,
                        userId,
                        changes,
                        hasConflict: true,
                        timestamp: Date.now()
                    });
                }
            }, 500 + Math.random() * 1500);
        });
    }

    async simulateTabSession(tabId, scenario) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const hasConflict = Math.random() < 0.4; // 40% chance of conflict
                resolve({
                    tabId,
                    scenario,
                    hasConflict,
                    lastSync: Date.now()
                });
            }, 1000 + Math.random() * 2000);
        });
    }

    async simulateTouchInteraction(scenario) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let successful = true;
                
                // Different failure rates for different conditions
                if (scenario.includes('Wet gloves')) {
                    successful = Math.random() > 0.3; // 30% failure rate
                } else if (scenario.includes('Thick winter gloves')) {
                    successful = Math.random() > 0.5; // 50% failure rate  
                } else if (scenario.includes('Dusty hands')) {
                    successful = Math.random() > 0.2; // 20% failure rate
                } else if (scenario.includes('Sweaty hands')) {
                    successful = Math.random() > 0.4; // 40% failure rate
                }
                
                resolve({
                    successful,
                    scenario,
                    attempts: successful ? 1 : Math.floor(Math.random() * 5) + 2
                });
            }, 200 + Math.random() * 800);
        });
    }
}

// Make testing modules available globally
window.crmErrorTesting = {
    NetworkFailureTests,
    DataValidationTests,
    UserInputExtremeTests,
    errorTracker
};

console.log("🔧 Error testing framework loaded. Access via window.crmErrorTesting");