Feature: Most Active Equities
  Verify HDFC Bank appears in the NSE Most Active Equities list

  Scenario: Check if HDFC is in Most Active equities
    Given the user is on the NSE India homepage
    When the user opens Most Active Equities under Market Data
    Then HDFC Bank should be visible in the list
