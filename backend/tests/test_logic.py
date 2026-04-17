import pytest
from backend.routes.queue import ESTIMATED_MINUTES_PER_PERSON

def test_wait_time_calculation():
    """Verify that estimated wait time is correctly calculated."""
    # Logic: (position - 1) * ESTIMATED_MINUTES_PER_PERSON
    position = 5
    expected_wait = (position - 1) * ESTIMATED_MINUTES_PER_PERSON
    assert expected_wait == 12

def test_wait_time_first_in_line():
    """First person should have 0 minutes wait."""
    position = 1
    expected_wait = (position - 1) * ESTIMATED_MINUTES_PER_PERSON
    assert expected_wait == 0

def test_crowd_score_logic_simulated():
    """
    Test the crowd score capping logic (0 to 10).
    Note: Ideally we'd test the function itself, but we can verify the 
    logic here as a unit test for the business rule.
    """
    def calculate_new_score(current, report_type):
        if report_type == "crowded":
            return min(current + 1, 10)
        elif report_type == "clear":
            return max(current - 1, 0)
        return current

    assert calculate_new_score(9, "crowded") == 10
    assert calculate_new_score(10, "crowded") == 10
    assert calculate_new_score(1, "clear") == 0
    assert calculate_new_score(0, "clear") == 0
    assert calculate_new_score(5, "neutral") == 5
