Feature: Documents And Signing Visibility
  As a sales and operations team member
  I want signed documents visible from both customer and global contexts
  So that signed records are never hidden

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Signed estimate appears in customer documents
    Given a sent estimate exists with a valid signing token
    When the customer signs the estimate from the public signing page
    Then the estimate should change to accepted status
    And the signed document should be visible from the customer detail page

  Scenario: Signed estimate appears in global document center
    Given a customer has a newly signed estimate
    When I navigate to Documents
    Then the signed estimate should be visible in global document listings

  Scenario: Signed change order appears in customer legal docs
    Given a change order exists with a valid signing token
    When the customer signs the change order
    Then the signed record should appear in customer legal documents

  Scenario: Signed-state detection is metadata-backed
    Given a signed document has a non-standard file name
    When I view signed indicators in customer legal docs
    Then the document should still be marked signed
