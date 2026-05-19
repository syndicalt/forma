from billing import calculate_total


def test_applies_discounts():
    assert calculate_total(100, 15) == 85
