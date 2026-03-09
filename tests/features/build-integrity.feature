Feature: Build Integrity
  As a developer
  I want the app to build without errors
  So that deployments never ship broken code

  Scenario: Production build completes successfully
    Given the source code is on the main branch
    When I run "npm run build"
    Then the build should exit with code 0
    And a dist/index.html file should exist
    And no TypeScript errors should be reported

  Scenario: No missing default exports
    Given all component files in src/components
    When the bundler resolves all imports
    Then every imported default export should exist in its source file

  Scenario: Environment variables are defined
    Given a .env file is present
    Then VITE_SUPABASE_URL should be defined and non-empty
    And VITE_SUPABASE_ANON_KEY should be defined and non-empty
