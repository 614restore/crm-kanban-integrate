Feature: Pipeline And Status Consistency
  As an operations manager
  I want status values to normalize consistently across all views
  So that pipeline, contact detail, and next-step behavior never disagree

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Alias statuses resolve to canonical pipeline stages
    Given a contact exists with status "appointment_set"
    When I view the Pipeline board
    Then the contact should appear in the "Appt Set" column
    And the contact should not appear in multiple columns

  Scenario: Inspection aliases map consistently between pipeline and timeline
    Given a contact exists with status "inspection_complete"
    When I open the contact detail status timeline
    Then the current step should display "Inspection Complete"
    When I return to Pipeline
    Then the contact should be in the inspection-complete stage column

  Scenario: Signed alias maps to signed stage everywhere
    Given a contact exists with status "signed_won"
    When I view the pipeline board
    Then the contact should appear in the signed stage
    When I open contact detail
    Then project status should display a signed-equivalent label

  Scenario: Paid stage keeps paid-specific behavior
    Given a contact exists with status "paid"
    When I open contact detail
    Then paid-dependent milestones should be marked complete
    And next-step actions should not regress to non-paid flows

  Scenario: Dashboard counts match pipeline counts after normalization
    Given contacts exist in canonical and alias status values
    When I compare dashboard stage totals with pipeline column totals
    Then totals should match for every canonical stage
