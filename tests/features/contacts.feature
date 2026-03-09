Feature: Contact Management
  As a company admin
  I want to manage contacts
  So that I can track clients and leads

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Contacts list loads without error
    When I navigate to the Contacts view
    Then I should see a list of contacts or an empty state
    And no error toast should appear

  Scenario: Creating a new contact saves to the database
    When I click "New Contact"
    And I fill in the first name, last name, and email
    And I click "Save Contact"
    Then the contact should appear in the contacts list
    And a success toast should appear

  Scenario: Contacts are isolated by company
    Given I am logged in as company A
    When I view the contacts list
    Then I should only see contacts belonging to company A
    And I should not see contacts from company B

  Scenario: Contact detail view loads crew schedule panel
    Given a contact exists with scheduled crew assignments
    When I open that contact's detail view
    Then the Crew Schedule panel should display the assignments
    And each assignment should show the crew member name
