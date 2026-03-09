Feature: Estimates View
  As a company admin
  I want to create, edit, and send estimates
  So that I can provide quotes to clients

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Estimates list loads without error
    When I navigate to the Estimates view
    Then I should see the estimates list or an empty state
    And no error toast should appear

  Scenario: Creating a new estimate saves to the database
    When I click "New Estimate"
    And I select a contact
    And I add at least one line item with a description and amount
    And I click "Save Estimate"
    Then the estimate should appear in the estimates list
    And a success toast should appear

  Scenario: Estimate total calculates correctly
    Given I am creating an estimate
    When I add a line item with quantity 2 and unit price 150
    Then the line item total should display 300
    And the estimate grand total should include that amount

  Scenario: Estimate status can be updated
    Given an estimate exists with status "draft"
    When I open the estimate
    And I change the status to "sent"
    And I save
    Then the estimate should display the "Sent" status badge

  Scenario: Estimate PDF export does not throw an error
    Given an estimate exists with at least one line item
    When I click "Export PDF"
    Then no error toast should appear
    And a file download should be initiated
