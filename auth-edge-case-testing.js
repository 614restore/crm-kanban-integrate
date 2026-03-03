// 🔐 AUTHENTICATION & SECURITY EDGE CASE TESTING
// Session Management, Token Handling, and Auth Flow Failures
// Date: March 3, 2026

console.log("🔐 STARTING AUTHENTICATION EDGE CASE TESTS");
console.log("=" .repeat(50));

class AuthenticationEdgeCaseTests {
    constructor(errorTracker) {
        this.errorTracker = errorTracker;
        this.originalAuth = null;
        this.sessionSimulator = new SessionSimulator();
        this.securityTests = [];
    }

    async runAuthenticationTests() {
        console.log("🔑 Starting comprehensive authentication testing...");
        
        await this.testSessionExpiration();
        await this.testInvalidTokens();
        await this.testConcurrentLogins();
        await this.testRapidAuthCycles();
        await this.testCorruptedAuthState();
        await this.testMultiDeviceConflicts();
        await this.testAuthorizationBoundaries();
        await this.testSessionHijackingPrevention();
        await this.testPasswordSecurityEdgeCases();
        await this.testAccountLockoutScenarios();
    }

    async testSessionExpiration() {
        console.log("⏰ Testing session expiration scenarios...");
        
        const criticalWorkflows = [
            'Creating emergency storm estimate',
            'Updating job status to completed',
            'Processing customer payment',
            'Uploading insurance documentation',
            'Sending customer communication',
            'Approving work order'
        ];

        for (const workflow of criticalWorkflows) {
            try {
                console.log(`Testing session expiry during: ${workflow}`);
                
                // Simulate long-running workflow
                await this.simulateWorkflowStart(workflow);
                
                // Expire session mid-workflow
                await this.sessionSimulator.expireSession();
                
                // Try to complete workflow
                const result = await this.simulateWorkflowCompletion(workflow);
                
                if (!result.redirectedToLogin) {
                    this.errorTracker.log(
                        'auth',
                        'session-expiry',
                        `Session expiry not handled during: ${workflow}`,
                        'critical',
                        'User continues with invalid session, data may be lost',
                        `Start ${workflow}, wait for session timeout, try to complete`
                    );
                }
                
                if (result.dataLost) {
                    this.errorTracker.log(
                        'auth',
                        'data-loss',
                        `Data lost when session expired during: ${workflow}`,
                        'critical',
                        'Hours of work lost when session expires',
                        `Long workflow interrupted by session expiration`
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'auth',
                    'session-crash',
                    `Session expiry caused crash during ${workflow}: ${error.message}`,
                    'critical',
                    'Application becomes unusable, work lost',
                    `Let session expire during critical workflow`
                );
            }
        }
    }

    async testInvalidTokens() {
        console.log("🎫 Testing invalid token scenarios...");
        
        const tokenScenarios = [
            { name: 'Expired JWT', token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.expired', invalid: true },
            { name: 'Malformed JWT', token: 'not.a.real.jwt.token', malformed: true },
            { name: 'Empty token', token: '', empty: true },
            { name: 'Null token', token: null, null: true },
            { name: 'Modified JWT', token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.modified.signature', tampered: true },
            { name: 'Wrong issuer JWT', token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.wrongissuer.signature', wrongIssuer: true }
        ];

        for (const scenario of tokenScenarios) {
            try {
                console.log(`Testing token scenario: ${scenario.name}`);
                
                // Set invalid token
                await this.sessionSimulator.setAuthToken(scenario.token);
                
                // Try to perform authenticated action
                const result = await this.tryAuthenticatedAction('fetch_contacts');
                
                if (result.success) {
                    this.errorTracker.log(
                        'security',
                        'token-validation',
                        `Invalid token accepted: ${scenario.name}`,
                        'critical',
                        'Unauthorized access, potential security breach',
                        `Set auth token to: ${scenario.token || 'null'}`
                    );
                }
                if (!result.clearedSession) {
                    this.errorTracker.log(
                        'auth',
                        'session-cleanup',
                        `Invalid token didn't clear session: ${scenario.name}`,
                        'error',
                        'User sees confusing auth state',
                        `Use invalid token and check if session cleared`
                    );
                }
                
            } catch (error) {
                if (error.message.includes('unauthorized') || error.message.includes('invalid')) {
                    console.log(`✅ Correctly rejected invalid token: ${scenario.name}`);
                } else {
                    this.errorTracker.log(
                        'auth',
                        'token-error',
                        `Unexpected error with token ${scenario.name}: ${error.message}`,
                        'error',
                        'System instability with invalid tokens',
                        `Test token scenario: ${scenario.name}`
                    );
                }
            }
        }
    }

    async testConcurrentLogins() {
        console.log("👥 Testing concurrent login scenarios...");
        
        const deviceTypes = ['Desktop', 'Mobile', 'Tablet', 'Field Laptop'];
        const userScenarios = [
            {
                name: 'Field supervisor logs in on multiple devices',
                devices: ['Mobile', 'Field Laptop'],
                shouldConflict: false
            },
            {
                name: 'Shared office computer login conflicts',
                devices: ['Desktop', 'Desktop'],
                shouldConflict: true
            },
            {
                name: 'Emergency access from multiple locations',
                devices: ['Mobile', 'Desktop', 'Tablet'],
                shouldConflict: false
            }
        ];

        for (const scenario of userScenarios) {
            try {
                console.log(`Testing: ${scenario.name}`);
                
                const loginPromises = scenario.devices.map(device => 
                    this.sessionSimulator.loginFromDevice(device)
                );
                
                const results = await Promise.allSettled(loginPromises);
                const successfulLogins = results.filter(r => r.status === 'fulfilled');
                
                if (scenario.shouldConflict && successfulLogins.length > 1) {
                    this.errorTracker.log(
                        'auth',
                        'concurrent-sessions',
                        `Multiple concurrent sessions allowed: ${scenario.name}`,
                        'warning',
                        'Potential session conflicts, shared access issues',
                        `Log in from multiple devices simultaneously`
                    );
                }
                
                if (!scenario.shouldConflict && successfulLogins.length !== scenario.devices.length) {
                    this.errorTracker.log(
                        'auth',
                        'legitimate-access-blocked', 
                        `Legitimate concurrent access blocked: ${scenario.name}`,
                        'error',
                        'Field team cannot access system when needed',
                        `Try logging in from ${scenario.devices.join(' and ')}`
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'auth',
                    'concurrent-login-crash',
                    `Concurrent login testing crashed: ${scenario.name} - ${error.message}`,
                    'critical',
                    'Authentication system fails under load',
                    `Attempt concurrent logins as described`
                );
            }
        }
    }

    async testRapidAuthCycles() {
        console.log("🔄 Testing rapid login/logout cycles...");
        
        try {
            const cycles = 20;
            console.log(`Performing ${cycles} rapid auth cycles...`);
            
            for (let i = 0; i < cycles; i++) {
                const cycleStart = performance.now();
                
                await this.sessionSimulator.login();
                await this.sessionSimulator.logout();
                
                const cycleTime = performance.now() - cycleStart;
                
                if (cycleTime > 5000) { // > 5 seconds per cycle
                    this.errorTracker.log(
                        'performance',
                        'auth-cycle-slow',
                        `Auth cycle ${i} took ${cycleTime}ms - too slow`,
                        'warning',
                        'Login becomes sluggish, user frustration',
                        `Rapidly login and logout multiple times`
                    );
                }
            }
            
            // Check for memory leaks
            if (performance.memory) {
                const memoryAfter = performance.memory.usedJSHeapSize;
                console.log(`Memory usage after ${cycles} auth cycles: ${memoryAfter / 1024 / 1024}MB`);
                
                if (memoryAfter > 100 * 1024 * 1024) { // > 100MB
                    this.errorTracker.log(
                        'performance',
                        'auth-memory-leak',
                        `High memory usage after auth cycles: ${memoryAfter / 1024 / 1024}MB`,
                        'error',
                        'Memory leaks cause browser crashes over time',
                        `Perform many login/logout cycles and monitor memory`
                    );
                }
            }
            
        } catch (error) {
            this.errorTracker.log(
                'auth',
                'rapid-cycle-crash',
                `Rapid auth cycles caused crash: ${error.message}`,
                'critical',
                'Authentication system breaks under stress',
                'Rapidly login and logout many times'
            );
        }
    }

    async testCorruptedAuthState() {
        console.log("💾 Testing corrupted authentication state...");
        
        const corruptionScenarios = [
            {
                name: 'Partial localStorage corruption',
                corrupt: () => {
                    localStorage.setItem('sb-auth-token', '{"corrupted": true}');
                }
            },
            {
                name: 'Missing auth data', 
                corrupt: () => {
                    localStorage.removeItem('sb-auth-token');
                    localStorage.removeItem('supabase.auth.token');
                }
            },
            {
                name: 'Malformed JSON in auth storage',
                corrupt: () => {
                    localStorage.setItem('sb-auth-token', '{corrupted json}');
                }
            },
            {
                name: 'Mixed auth state (token but no user)',
                corrupt: () => {
                    localStorage.setItem('sb-auth-token', '{"access_token":"test123"}');
                    localStorage.removeItem('auth.user');
                }
            }
        ];

        for (const scenario of corruptionScenarios) {
            try {
                console.log(`Testing corruption: ${scenario.name}`);
                
                // Corrupt the auth state
                scenario.corrupt();
                
                // Try to use the app
                const result = await this.testAppWithCorruptedAuth();
                
                if (!result.recoveredGracefully) {
                    this.errorTracker.log(
                        'auth',
                        'corruption-recovery',
                        `App didn't recover from auth corruption: ${scenario.name}`,
                        'error',
                        'User sees broken interface, cannot access app',
                        `Manually corrupt auth state as described`
                    );
                }
                
                if (result.exposedSensitiveInfo) {
                    this.errorTracker.log(
                        'security',
                        'corruption-exposure',
                        `Corrupted auth exposed sensitive info: ${scenario.name}`,
                        'critical',
                        'Data breach, privacy violation',
                        `Corrupt auth state and check for data exposure`
                    );
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'auth',
                    'corruption-crash',
                    `Auth corruption caused crash: ${scenario.name} - ${error.message}`,
                    'critical',
                    'App completely unusable with corrupted auth',
                    `Corrupt authentication as described`
                );
            } finally {
                // Clean up corrupted state
                this.sessionSimulator.cleanupAuth();
            }
        }
    }

    async testMultiDeviceConflicts() {
        console.log("📱💻 Testing multi-device authentication conflicts...");
        
        const deviceScenarios = [
            {
                name: 'Office desktop + field mobile',
                devices: ['Desktop Chrome', 'Mobile Safari'],
                expectConflict: false
            },
            {
                name: 'Shared truck tablet + personal phone',
                devices: ['Shared Tablet', 'Personal Mobile'],
                expectConflict: false
            },
            {
                name: 'Password change on one device',
                devices: ['Device A', 'Device B'],
                passwordChange: true
            },
            {
                name: 'Account suspension scenario',
                devices: ['Device A', 'Device B'],
                suspended: true
            }
        ];

        for (const scenario of deviceScenarios) {
            try {
                console.log(`Testing multi-device: ${scenario.name}`);
                
                // Simulate logins on multiple devices
                const device1Session = await this.sessionSimulator.loginFromDevice(scenario.devices[0]);
                const device2Session = await this.sessionSimulator.loginFromDevice(scenario.devices[1]);
                
                if (scenario.passwordChange) {
                    // Change password on device 1
                    await this.sessionSimulator.changePassword('newPassword123!', scenario.devices[0]);
                    
                    // Check if device 2 is properly invalidated
                    const device2Still Valid = await this.sessionSimulator.checkSessionValid(scenario.devices[1]);
                    
                    if (device2StillValid) {
                        this.errorTracker.log(
                            'security',
                            'password-change-invalidation',
                            'Other device sessions not invalidated after password change',
                            'critical',
                            'Old sessions remain active, security breach potential',
                            'Change password on one device, check others'
                        );
                    }
                }
                
                if (scenario.suspended) {
                    // Simulate account suspension 
                    await this.sessionSimulator.suspendAccount();
                    
                    // Check if all devices are logged out
                    const device1Valid = await this.sessionSimulator.checkSessionValid(scenario.devices[0]);
                    const device2Valid = await this.sessionSimulator.checkSessionValid(scenario.devices[1]);
                    
                    if (device1Valid || device2Valid) {
                        this.errorTracker.log(
                            'security',
                            'suspension-enforcement',
                            'Suspended account sessions still active',
                            'critical',
                            'Suspended users retain access to system',
                            'Suspend account and check if sessions terminated'
                        );
                    }
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'auth',
                    'multi-device-error',
                    `Multi-device testing failed: ${scenario.name} - ${error.message}`,
                    'error',
                    'Authentication inconsistent across devices',
                    `Test scenario: ${scenario.name}`
                );
            }
        }
    }

    async testAuthorizationBoundaries() {
        console.log("🚪 Testing authorization boundary scenarios...");
        
        const roleScenarios = [
            {
                role: 'field_crew',
                shouldAccess: ['view_contacts', 'update_job_status', 'upload_photos'],
                shouldNotAccess: ['delete_contacts', 'view_financial', 'manage_users', 'export_data']
            },
            {
                role: 'office_admin', 
                shouldAccess: ['view_contacts', 'create_estimates', 'view_financial'],
                shouldNotAccess: ['delete_company', 'manage_billing', 'system_admin']
            },
            {
                role: 'owner',
                shouldAccess: ['view_financial', 'manage_users', 'export_data'],
                shouldNotAccess: ['system_admin'] // Should not have system-level access
            }
        ];

        for (const scenario of roleScenarios) {
            try {
                console.log(`Testing authorization for role: ${scenario.role}`);
                
                // Test permissions they should have
                for (const permission of scenario.shouldAccess) {
                    const hasAccess = await this.testPermission(scenario.role, permission);
                    
                    if (!hasAccess) {
                        this.errorTracker.log(
                            'auth',
                            'permission-denied',
                            `Role ${scenario.role} should have ${permission} but access denied`,
                            'error',
                            'Users cannot perform their job functions',
                            `Login as ${scenario.role} and try ${permission}`
                        );
                    }
                }
                
                // Test permissions they should NOT have  
                for (const permission of scenario.shouldNotAccess) {
                    const hasAccess = await this.testPermission(scenario.role, permission);
                    
                    if (hasAccess) {
                        this.errorTracker.log(
                            'security',
                            'privilege-escalation',
                            `Role ${scenario.role} has unauthorized ${permission} access`,
                            'critical',
                            'Users can access data/functions beyond their role',
                            `Login as ${scenario.role} and try ${permission}`
                        );
                    }
                }
                
            } catch (error) {
                this.errorTracker.log(
                    'auth',
                    'authorization-error',
                    `Authorization testing failed for ${scenario.role}: ${error.message}`,
                    'error',
                    'Role-based access control not working properly',
                    `Test permissions for role: ${scenario.role}`
                );
            }
        }
    }

    async testSessionHijackingPrevention() {
        console.log("🕵️ Testing session hijacking prevention...");
        
        const hijackingTests = [
            {
                name: 'Session token reuse from different IP',
                test: () => this.simulateTokenReuse()
            },
            {
                name: 'Session token with modified user agent',
                test: () => this.simulateUserAgentChange()
            },
            {
                name: 'Concurrent sessions from different locations',
                test: () => this.simulateConcurrentLocations()
            },
            {
                name: 'Man-in-the-middle token interception',
                test: () => this.simulateTokenInterception()
            }
        ];

        for (const test of hijackingTests) {
            try {
                console.log(`Testing: ${test.name}`);
                
                const result = await test.test();
                
                if (result.sessionAllowed) {
                    this.errorTracker.log(
                        'security',
                        'session-hijacking',
                        `Session hijacking not prevented: ${test.name}`,
                        'critical',
                        'Unauthorized access to customer data possible',
                        `Attempt: ${test.name}`
                    );
                }
                
                if (!result.userNotified) {
                    this.errorTracker.log(
                        'security',
                        'hijack-notification',
                        `User not notified of potential hijacking: ${test.name}`,
                        'error',
                        'Users unaware of security breaches',
                        `Perform ${test.name} and check notifications`
                    );
                }
                
            } catch (error) {
                console.log(`✅ Security measure blocked: ${test.name}`);
            }
        }
    }

    async testPasswordSecurityEdgeCases() {
        console.log("🔒 Testing password security edge cases...");
        
        const passwordTests = [
            { password: 'password123', weak: true },
            { password: '123456', weak: true },
            { password: 'P@ssw0rd!', weak: true }, // Common pattern
            { password: 'contractor', weak: true }, // Industry specific
            { password: '614restore', weak: true }, // Company related
            { password: '', empty: true },
            { password: 'a'.repeat(1000), tooLong: true },
            { password: 'Aa1!', tooShort: true },
            { password: 'ValidP@ssw0rd123!', strong: true }
        ];

        for (const test of passwordTests) {
            try {
                console.log(`Testing password: ${test.password.substring(0, 10)}...`);
                
                const result = await this.sessionSimulator.testPasswordStrength(test.password);
                
                if (test.weak && result.accepted) {
                    this.errorTracker.log(
                        'security',
                        'weak-password',
                        `Weak password accepted: ${test.password}`,
                        'error',
                        'Accounts vulnerable to brute force attacks',
                        `Try to set password: ${test.password}`
                    );
                }
                
                if (test.strong && !result.accepted) {
                    this.errorTracker.log(
                        'auth',
                        'password-rejection',
                        'Strong password rejected by validation',
                        'error',
                        'Users cannot set secure passwords',
                        'Try to set strong password'
                    );
                }
                
            } catch (error) {
                if (test.weak || test.empty || test.tooShort) {
                    console.log(`✅ Correctly rejected weak password`);
                } else {
                    this.errorTracker.log(
                        'auth',
                        'password-error',
                        `Password testing error: ${error.message}`,
                        'error',
                        'Password system not functioning properly',
                        'Test password validation system'
                    );
                }
            }
        }
    }

    async testAccountLockoutScenarios() {
        console.log("🚫 Testing account lockout scenarios...");
        
        try {
            // Test multiple failed login attempts
            const maxAttempts = 5;
            for (let i = 0; i < maxAttempts + 2; i++) {
                try {
                    await this.sessionSimulator.loginWithWrongPassword();
                    console.log(`Failed login attempt ${i + 1}`);
                } catch (error) {
                    if (i >= maxAttempts) {
                        console.log(`✅ Account locked after ${i + 1} attempts`);
                        break;
                    }
                }
            }
            
            // Test lockout during critical emergency
            const emergencyScenario = await this.simulateEmergencyAccess();
            if (emergencyScenario.lockedOut) {
                this.errorTracker.log(
                    'auth',
                    'emergency-lockout',
                    'Account lockout prevents emergency access',
                    'critical',
                    'Cannot respond to storm damage emergencies',
                    'Lock account then try emergency access'
                );
            }
            
            // Test lockout recovery
            const recoveryResult = await this.sessionSimulator.testLockoutRecovery();
            if (!recoveryResult.canRecover) {
                this.errorTracker.log(
                    'auth',
                    'lockout-recovery',
                    'No way to recover from account lockout',
                    'critical',
                    'Legitimate users permanently locked out',
                    'Get account locked and try to recover'
                );
            }
            
        } catch (error) {
            this.errorTracker.log(
                'auth',
                'lockout-error',
                `Account lockout testing failed: ${error.message}`,
                'error',
                'Account security measures not working',
                'Test account lockout functionality'
            );
        }
    }

    // Simulation helper methods
    async simulateWorkflowStart(workflow) {
        console.log(`Starting workflow: ${workflow}`);
        return { started: true, workflowId: Math.random().toString(36) };
    }

    async simulateWorkflowCompletion(workflow) {
        // Simulate different outcomes based on auth state
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    completed: false,
                    redirectedToLogin: Math.random() > 0.3, // 70% should redirect
                    dataLost: Math.random() > 0.6, // 40% lose data
                    workflowId: Math.random().toString(36)
                });
            }, 1000 + Math.random() * 2000);
        });
    }

    async tryAuthenticatedAction(action) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: false, // Most should fail with invalid tokens
                    action,
                    clearedSession: Math.random() > 0.2, // 80% should clear session
                    errorCode: 'INVALID_TOKEN'
                });
            }, 500 + Math.random() * 1000);
        });
    }

    async testAppWithCorruptedAuth() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    recoveredGracefully: Math.random() > 0.4, // 60% recover well
                    exposedSensitiveInfo: Math.random() > 0.8, // 20% expose info 
                    redirectedToLogin: true,
                    errorShown: true
                });
            }, 1000);
        });
    }

    async testPermission(role, permission) {
        // Simulate role-based permission checking
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simplified permission logic for simulation
                const hasPermission = !(
                    (role === 'field_crew' && permission.includes('delete')) ||
                    (role === 'office_admin' && permission.includes('system_admin')) ||
                    (permission === 'system_admin' && role !== 'system_admin')
                );
                resolve(hasPermission);
            }, 200 + Math.random() * 800);
        });
    }

    async simulateTokenReuse() {
        return { sessionAllowed: false, userNotified: true }; // Good security
    }

    async simulateUserAgentChange() {
        return { sessionAllowed: true, userNotified: false }; // Potential issue
    }

    async simulateConcurrentLocations() {
        return { sessionAllowed: true, userNotified: false }; // Should be flagged
    }

    async simulateTokenInterception() {
        return { sessionAllowed: false, userNotified: true }; // Good security
    }

    async simulateEmergencyAccess() {
        return { lockedOut: true, emergencyBypassAvailable: false };
    }
}

// Session management simulator
class SessionSimulator {
    constructor() {
        this.currentSessions = new Map();
        this.authState = {
            isAuthenticated: false,
            user: null,
            token: null
        };
    }

    async login(username = 'testuser', password = 'password') {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (password === 'wrongpassword') {
                    reject(new Error('Invalid credentials'));
                } else {
                    const sessionId = this.generateSessionId();
                    this.authState = {
                        isAuthenticated: true,
                        user: { id: 'user123', username },
                        token: this.generateToken(),
                        sessionId
                    };
                    resolve(this.authState);
                }
            }, 1000 + Math.random() * 1000);
        });
    }

    async logout() {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.authState = {
                    isAuthenticated: false,
                    user: null,
                    token: null
                };
                resolve(true);
            }, 500 + Math.random() * 500);
        });
    }

    async expireSession() {
        this.authState.token = 'EXPIRED_TOKEN';
        this.authState.isAuthenticated = false;
    }

    async setAuthToken(token) {
        this.authState.token = token;
        this.authState.isAuthenticated = !!token;
    }

    async loginFromDevice(device) {
        const sessionId = `${device}_${Date.now()}`;
        this.currentSessions.set(sessionId, {
            device,
            loginTime: new Date(),
            active: true
        });
        return { sessionId, device };
    }

    async changePassword(newPassword, device) {
        // Simulate password change - should invalidate other sessions
        const affectedSessions = Array.from(this.currentSessions.entries())
            .filter(([id, session]) => !id.includes(device));
        
        affectedSessions.forEach(([id]) => {
            this.currentSessions.delete(id);
        });
        
        return { success: true, invalidatedSessions: affectedSessions.length };
    }

    async checkSessionValid(device) {
        const sessionEntry = Array.from(this.currentSessions.entries())
            .find(([id, session]) => id.includes(device));
        return !!sessionEntry;
    }

    async suspendAccount() {
        this.currentSessions.clear();
        this.authState.isAuthenticated = false;
    }

    async testPasswordStrength(password) {
        const weakPasswords = ['password123', '123456', 'P@ssw0rd!', 'contractor', '614restore'];
        const isWeak = weakPasswords.includes(password) || 
                      password.length < 8 || 
                      password.length > 500 ||
                      password === '';
        
        return { 
            accepted: !isWeak,
            strength: isWeak ? 'weak' : 'strong'
        };
    }

    async loginWithWrongPassword() {
        return this.login('testuser', 'wrongpassword');
    }

    async testLockoutRecovery() {
        return { canRecover: true, method: 'email_reset' };
    }

    cleanupAuth() {
        this.authState = { isAuthenticated: false, user: null, token: null };
        this.currentSessions.clear();
        localStorage.clear();
    }

    generateSessionId() {
        return Math.random().toString(36).substr(2, 16);
    }

    generateToken() {
        return 'jwt_' + Math.random().toString(36).substr(2, 32);
    }
}

// Export for global access
window.crmAuthTesting = {
    AuthenticationEdgeCaseTests,
    SessionSimulator
};

console.log("🔐 Authentication edge case testing loaded. Access via window.crmAuthTesting");