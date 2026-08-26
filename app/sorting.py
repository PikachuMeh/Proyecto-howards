"""
Pure Sorting Hat Algorithm Module (NFR-09).
Contains no database or HTTP dependencies so it can be unit tested independently.
"""

from typing import Dict, List, Any, Optional
import random

class SortingError(ValueError):
    """Raised when sorting calculations cannot proceed due to invalid input."""
    pass


def compute_house_assignment(
    house_scores: Dict[str, int],
    question_contributions: Optional[Dict[str, int]] = None,
    house_participant_counts: Optional[Dict[str, int]] = None,
    participant_id: int = 1,
    balancing_mode: bool = False,
    balance_threshold: int = 4,
    balance_penalty: int = 3,
) -> Dict[str, Any]:
    """
    Computes the winning house for a participant based on scoring, tie-breaking, and optional balancing.

    :param house_scores: Map of house codes to their accumulated points, e.g. {'GRY': 20, 'RAV': 5, 'HUF': 3, 'SLY': 1}
    :param question_contributions: Map of house codes to count of distinct questions that awarded points to that house.
    :param house_participant_counts: Current total assigned participants per house code.
    :param participant_id: ID of the participant used as deterministic seed for final tie-break.
    :param balancing_mode: Whether house balancing penalty is active.
    :param balance_threshold: Maximum allowed gap between largest and smallest house before penalty is applied.
    :param balance_penalty: Points subtracted from the most saturated house when balancing is triggered.
    :return: Dict with 'winner', 'final_scores', 'original_scores', 'applied_tie_breaker', 'is_hesitant'
    """
    if not house_scores:
        raise SortingError("No house scores provided for assignment computation.")

    houses = list(house_scores.keys())
    if not houses:
        raise SortingError("House score list cannot be empty.")

    original_scores = dict(house_scores)
    effective_scores = dict(house_scores)

    counts = house_participant_counts or {h: 0 for h in houses}
    q_counts = question_contributions or {h: 0 for h in houses}

    # 1. House Balancing Mode (Section 8.3, FR-18)
    if balancing_mode and len(counts) > 1:
        current_counts = [counts.get(h, 0) for h in houses]
        max_count = max(current_counts)
        min_count = min(current_counts)
        if (max_count - min_count) >= balance_threshold:
            # Saturated houses receive a penalty
            for h in houses:
                if counts.get(h, 0) == max_count:
                    effective_scores[h] = max(0, effective_scores[h] - balance_penalty)

    # Calculate whether it is a "Hesitant Hat" scenario (top 2 houses within 2 points)
    sorted_effective = sorted(effective_scores.values(), reverse=True)
    is_hesitant = False
    if len(sorted_effective) >= 2 and (sorted_effective[0] - sorted_effective[1]) <= 2:
        is_hesitant = True

    # Find highest effective score
    max_score = max(effective_scores.values())
    top_candidates = [h for h in houses if effective_scores[h] == max_score]

    # If single clear winner
    if len(top_candidates) == 1:
        winner = top_candidates[0]
        tie_breaker_used = None
    else:
        # 2. Tie-Breaking Rules (Section 8.2, FR-07)
        tie_breaker_used = "Rule 1: Distinct questions"
        # Rule 1: The house that scored points across the most distinct questions wins.
        max_q = max(q_counts.get(h, 0) for h in top_candidates)
        candidates_after_r1 = [h for h in top_candidates if q_counts.get(h, 0) == max_q]

        if len(candidates_after_r1) == 1:
            winner = candidates_after_r1[0]
        else:
            # Rule 2: If still tied, the house with fewer participants assigned at that moment wins.
            tie_breaker_used = "Rule 2: Fewest participants in house"
            min_occupancy = min(counts.get(h, 0) for h in candidates_after_r1)
            candidates_after_r2 = [h for h in candidates_after_r1 if counts.get(h, 0) == min_occupancy]

            if len(candidates_after_r2) == 1:
                winner = candidates_after_r2[0]
            else:
                # Rule 3: Deterministic pseudo-random seed using participant's id for 100% reproducibility.
                tie_breaker_used = "Rule 3: Deterministic participant seed"
                # Sort candidates alphabetically first for consistency across Python runs
                candidates_after_r2.sort()
                rng = random.Random(participant_id)
                winner = rng.choice(candidates_after_r2)

    return {
        "winner": winner,
        "final_scores": effective_scores,
        "original_scores": original_scores,
        "applied_tie_breaker": tie_breaker_used,
        "is_hesitant": is_hesitant,
        "total_score": effective_scores[winner]
    }
