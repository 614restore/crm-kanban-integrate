Feature: Automations View
  As a company admin
  I want to create and manage automation rules
  So that the CRM can act automatically on key events

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Automations list loads without error
    When I navigate to the Automations view
    Then I should see the automations list
    And no error toast should appear

  Scenario: Active automation count reflects real data
    Given 3 automations are active and 2 are inactive
    When I view the Automations summary stats
    Then the Active Automations count should display 3
    And the Inactive count should display 2

  Scenario: Run history panel shows real log entries
    Given automation logs exist in the database
    When I click "View Run History" on an automation
    Then I should see a list of run log entries
    And each entry should show a timestamp and status
    And the panel should not display "0 runs" when logs exist

  Scenario: Suggestion cards can be applied
    When I view the Automation Suggestions panel
    And I click "Apply" on a suggestion card
    Then a new automation should be created
    And a success toast should appear
    And the suggestion card should be removed from the list

  Scenario: Creating a new automation saves successfully
    When I click "New Automation"
    And I fill in the automation name
    And I select a trigger event
    And I click "Save Automation"
    Then the automation should appear in the list
    And a success toast should say "Automation created"
