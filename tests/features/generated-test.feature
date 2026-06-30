Feature: Verify MSN Portal and Navigation
  Scenario: User navigates to Breaking News and verifies headline
    Given the user is on the MSN India homepage
    When the user clicks on the "Breaking The Economic Times" link
    Then a new page with heading containing "US Supreme Court rejects" should be visible
