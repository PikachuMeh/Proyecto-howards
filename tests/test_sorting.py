import pytest
from app.sorting import compute_house_assignment, SortingError

def test_clear_winner():
    """Section 11.1 Case 1: Clear winner."""
    scores = {"GRY": 20, "RAV": 5, "HUF": 3, "SLY": 1}
    res = compute_house_assignment(scores)
    assert res["winner"] == "GRY"
    assert res["applied_tie_breaker"] is None
    assert res["total_score"] == 20
    assert not res["is_hesitant"]

def test_two_way_tie_rule1_distinct_questions():
    """Section 11.1 Case 2a: Two-way tie broken by Rule 1 (distinct questions)."""
    scores = {"GRY": 12, "RAV": 12, "HUF": 4, "SLY": 2}
    # GRY got points on 4 questions, RAV on only 3 questions
    q_counts = {"GRY": 4, "RAV": 3, "HUF": 1, "SLY": 1}
    res = compute_house_assignment(scores, question_contributions=q_counts)
    assert res["winner"] == "GRY"
    assert res["applied_tie_breaker"] == "Rule 1: Distinct questions"

def test_two_way_tie_rule2_house_occupancy():
    """Section 11.1 Case 2b: Two-way tie broken by Rule 2 (fewest participants)."""
    scores = {"GRY": 12, "RAV": 12, "HUF": 4, "SLY": 2}
    q_counts = {"GRY": 3, "RAV": 3, "HUF": 1, "SLY": 1}
    # RAV has fewer people (2 vs 5)
    counts = {"GRY": 5, "RAV": 2, "HUF": 4, "SLY": 3}
    res = compute_house_assignment(scores, question_contributions=q_counts, house_participant_counts=counts)
    assert res["winner"] == "RAV"
    assert res["applied_tie_breaker"] == "Rule 2: Fewest participants in house"

def test_two_way_tie_rule3_participant_seed():
    """Section 11.1 Case 2c: Two-way tie broken deterministically by participant id seed."""
    scores = {"GRY": 12, "RAV": 12, "HUF": 4, "SLY": 2}
    q_counts = {"GRY": 3, "RAV": 3, "HUF": 1, "SLY": 1}
    counts = {"GRY": 2, "RAV": 2, "HUF": 2, "SLY": 2}
    
    res1 = compute_house_assignment(scores, question_contributions=q_counts, house_participant_counts=counts, participant_id=42)
    res2 = compute_house_assignment(scores, question_contributions=q_counts, house_participant_counts=counts, participant_id=42)
    
    assert res1["winner"] in ["GRY", "RAV"]
    assert res1["winner"] == res2["winner"]
    assert res1["applied_tie_breaker"] == "Rule 3: Deterministic participant seed"

def test_four_way_tie_does_not_throw():
    """Section 11.1 Case 3: Four-way tie returns a valid house without throwing."""
    scores = {"GRY": 8, "RAV": 8, "HUF": 8, "SLY": 8}
    res = compute_house_assignment(scores, participant_id=99)
    assert res["winner"] in ["GRY", "RAV", "HUF", "SLY"]
    assert res["total_score"] == 8

def test_empty_scores_raises_error():
    """Section 11.1 Case 4: Missing answers / empty score raises controlled error."""
    with pytest.raises(SortingError):
        compute_house_assignment({})

def test_balancing_mode_penalizes_saturated_house():
    """Section 11.1 Case 5: Balancing mode on penalizes saturated house."""
    scores = {"GRY": 10, "RAV": 9, "HUF": 8, "SLY": 5}
    # GRY has 10 members, HUF has 1 member -> gap is 9 >= 4
    counts = {"GRY": 10, "RAV": 3, "HUF": 1, "SLY": 2}
    
    # Without balancing, GRY wins
    res_unbalanced = compute_house_assignment(scores, house_participant_counts=counts, balancing_mode=False)
    assert res_unbalanced["winner"] == "GRY"
    
    # With balancing, GRY loses 3 points (10 - 3 = 7), so RAV (9 points) wins!
    res_balanced = compute_house_assignment(scores, house_participant_counts=counts, balancing_mode=True, balance_threshold=4, balance_penalty=3)
    assert res_balanced["winner"] == "RAV"
    assert res_balanced["final_scores"]["GRY"] == 7

def test_hesitant_hat_mode():
    """Hesitant Hat is True when top 2 houses are within 2 points."""
    scores = {"GRY": 15, "RAV": 14, "HUF": 6, "SLY": 4}
    res = compute_house_assignment(scores)
    assert res["is_hesitant"] is True
    
    decisive_scores = {"GRY": 20, "RAV": 10, "HUF": 5, "SLY": 2}
    res2 = compute_house_assignment(decisive_scores)
    assert res2["is_hesitant"] is False
