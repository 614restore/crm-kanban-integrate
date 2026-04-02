Feature: Scheduling And Next Step Reliability
  As a coordinator
  I want all scheduling entry points to save reliably
  So that appointments and next steps are never lost

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Schedule Next Step creates appointment from contact detail
    Given a contact exists in status "lead"
    When I click "Schedule Next Step" from contact detail
    And I complete required appointment fields
    And I click "Save"
    Then a new appointment should be visible in calendar
    And the contact status should advance if workflow rules require it

  Scenario: Appointment save remains available on compact mobile viewport
    Given I am on a phone-sized viewport
    When I open the appointment modal
    And the keyboard is open
    Then the save action should remain reachable

  Scenario: Failed appointment write shows visible error feedback
    Given appointment persistence fails due to API error
    When I attempt to save an appointment
    Then an error toast should be shown
    And no success message should be shown

  Scenario: Completing inspection advances status once
    Given a contact has an existing appointment-set status
    When I mark the inspection appointment complete
    Then the contact status should advance to inspection-complete state
    And the transition should happen exactly once
