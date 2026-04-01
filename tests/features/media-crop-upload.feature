Feature: Media Crop And Upload Reliability
  As an admin user
  I want avatar/logo uploads to crop and save consistently
  So that company and profile branding always render correctly

  Background:
    Given the app has loaded successfully
    And I am authenticated as a company admin

  Scenario: Company logo cropper opens with selected image
    When I upload a company logo image in Settings
    Then the crop dialog should display the selected image
    And the crop area should not be black or empty

  Scenario: Profile avatar cropper opens with selected image
    When I upload a profile avatar image in Settings
    Then the crop dialog should display the selected image
    And the crop area should not be black or empty

  Scenario: Closing one crop dialog must not revoke active image URL for another dialog
    Given a crop image URL exists
    When I open and close upload dialogs quickly
    Then the active crop dialog should keep a valid image source

  Scenario: Cropped image persists after save and refresh
    When I crop and save a profile image
    Then the saved image should display in the sidebar profile section
    And the image should still display after page refresh
