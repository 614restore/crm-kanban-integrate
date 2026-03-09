Feature: Crew Schedule View
  As a company admin
  I want to manage crew assignments on a weekly calendar
  So that I can track who is working and where

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Internal crew members display full name
    When I navigate to the Crew Schedule view
    Then each internal crew row should show a first and last name
    And no crew row should display "Unnamed"
    And no crew row should display "null null"

  Scenario: Subcontractor crews load with company name
    Given at least one subcontractor crew exists in the database
    When I navigate to the Crew Schedule view
    Then the subcontractor row should display the company_name value
    And the subcontractor badge should show "Sub"

  Scenario: Open Slots stat never goes negative
    Given there are more assignments than available crew-day slots this week
    When I view the weekly stats bar
    Then the Open Slots count should be 0 or greater
    And the count should never display a negative number

  Scenario: Creating a new assignment routes FK correctly
    When I click an empty cell for an internal crew member
    And I fill in the assignment title
    And I click "Add Assignment"
    Then the saved record should have crew_member_id set
    And the saved record should have subcontractor_id as null

  Scenario: Creating a subcontractor assignment routes FK correctly
    When I click an empty cell for a subcontractor crew member
    And I fill in the assignment title
    And I click "Add Assignment"
    Then the saved record should have subcontractor_id set
    And the saved record should have crew_member_id as null

  Scenario: Conflict warning shows on double-booking
    Given a crew member already has an assignment on Monday
    When I click Monday's cell for that crew member
    Then I should see a conflict warning banner
    And the warning should mention "already has an assignment"

  Scenario: Week navigation moves to previous and next week
    When I click the left chevron button
    Then the week header should show the previous week's dates
    When I click "Today"
    Then the week header should show the current week's dates
