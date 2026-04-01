Feature: Mobile Responsive Stability
  As a mobile user
  I want stable navigation and gestures
  So that I can operate the CRM without drift or layout glitches

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: No horizontal drift on core views
    Given I am using a phone-sized viewport
    When I open Dashboard, Contacts, Pipeline, and Calendar
    Then each view should remain locked to viewport width
    And no horizontal scrolling should occur by default

  Scenario: Bottom navigation remains visible after search and filter
    Given I am on mobile navigation layout
    When I perform search and apply filters in contacts
    Then bottom navigation should remain visible and usable

  Scenario: Tab and content scrolling prioritize vertical gestures
    Given I am viewing a tabbed contact detail section on mobile
    When I scroll vertically through content
    Then vertical scroll should win over horizontal tab-strip drag

  Scenario: Mobile photo capture flow remains stable
    Given I open the mobile photo capture surface
    When I capture or attach a photo
    Then preview should render
    And upload action should remain available
