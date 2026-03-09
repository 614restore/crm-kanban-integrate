Feature: Authentication & Authorization
  As a user
  I want secure login and role-based access
  So that only authorized users can access company data

  Background:
    Given the app has loaded successfully

  Scenario: Unauthenticated user is redirected to login
    Given I am not logged in
    When I navigate to the dashboard
    Then I should be redirected to the login page

  Scenario: Valid login succeeds
    When I enter valid credentials
    And I click "Sign In"
    Then I should be redirected to the dashboard
    And my company's data should be visible

  Scenario: Invalid login shows error
    When I enter an invalid password
    And I click "Sign In"
    Then an error message should appear
    And I should remain on the login page

  Scenario: Admin can access Settings
    Given I am logged in as an admin
    When I navigate to Settings
    Then I should see all settings sections

  Scenario: Non-admin cannot access admin-only settings
    Given I am logged in as a standard team member
    When I navigate to Settings
    Then admin-only sections should be hidden or disabled
