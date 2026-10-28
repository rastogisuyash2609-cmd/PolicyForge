"""Tests for PolicyForge models and closed-vocabulary schemas."""

from copy import deepcopy
import json
from pathlib import Path
from typing import Any
import pytest
from pydantic import ValidationError

from policyforge.models import (
    EventType,
    DecisionType,
    EffectType,
    Operator,
    StateField,
    CustomerTier,
    State,
    LeafCondition,
    AllCondition,
    AnyCondition,
    RuleSource,
    Rule,
    Finding,
    FindingType,
    FindingSeverity,
    Event,
    parse_condition_tree,
)


def _fixture_rule() -> dict[str, Any]:
    path = Path(__file__).parent / "fixtures" / "nebius_smoke" / "valid_policy_ir.json"
    return json.loads(path.read_text(encoding="utf-8"))["rules"][0]


def test_corrected_leaf_is_valid_inside_complete_parent_rule() -> None:
    leaf = {"field": "days_since_delivery", "op": "LTE", "value": 30}
    assert LeafCondition.model_validate(leaf).value == 30
    rule = _fixture_rule()
    rule["when"] = leaf
    parsed = Rule.model_validate(rule)
    assert isinstance(parsed.when, LeafCondition)
    assert parsed.when.field == StateField.DAYS_SINCE_DELIVERY
    # The leaf is not a complete Rule or a response envelope.
    with pytest.raises(ValidationError):
        Rule.model_validate(leaf)


@pytest.mark.parametrize("wrapper", ["leaf", "all", "any"])
def test_recorded_dynamic_key_condition_is_rejected_in_every_position(wrapper: str) -> None:
    path = Path(__file__).parent / "fixtures" / "nebius_smoke" / "second_live_metadata.json"
    condition = json.loads(path.read_text(encoding="utf-8"))["invalid_condition"]
    original = deepcopy(condition)
    with pytest.raises(ValidationError):
        LeafCondition.model_validate(condition)
    rule = _fixture_rule()
    rule["when"] = condition if wrapper == "leaf" else {wrapper: [condition]}
    with pytest.raises(ValidationError):
        Rule.model_validate(rule)
    assert condition == original  # No dynamic-key conversion is performed.


@pytest.mark.parametrize("operator", ["BETWEEN", "LESS_THAN_OR_EQUAL", "lte", "EXECUTE"])
def test_unsupported_condition_operators_are_rejected(operator: str) -> None:
    rule = _fixture_rule()
    rule["when"] = {"field": "days_since_delivery", "op": operator, "value": 30}
    with pytest.raises(ValidationError):
        Rule.model_validate(rule)


def test_nested_and_or_conditions_round_trip_without_changing_meaning() -> None:
    condition = {"all": [
        {"field": "item_delivered", "op": "IS_TRUE", "value": True},
        {"any": [
            {"field": "days_since_delivery", "op": "LTE", "value": 30},
            {"all": [
                {"field": "days_since_delivery", "op": "LTE", "value": 60},
                {"field": "customer_tier", "op": "EQ", "value": "VIP"},
            ]},
        ]},
    ]}
    rule = _fixture_rule()
    rule["when"] = deepcopy(condition)
    assert Rule.model_validate(rule).when.model_dump(mode="json") == condition


@pytest.mark.parametrize("field", Rule.model_json_schema()["required"])
def test_every_mandatory_parent_rule_field_is_required(field: str) -> None:
    rule = _fixture_rule()
    rule.pop(field)
    with pytest.raises(ValidationError):
        Rule.model_validate(rule)


def test_closed_vocabulary_event_types():
    assert EventType.ORDER_PLACED == "ORDER_PLACED"
    assert EventType.REFUND_REQUESTED == "REFUND_REQUESTED"

    with pytest.raises(ValidationError):
        Event(event_type="INVALID_EVENT", day=1)


def test_closed_vocabulary_state_fields():
    state = State(order_placed=True, customer_tier=CustomerTier.VIP)
    assert state.order_placed is True
    assert state.customer_tier == CustomerTier.VIP

    # Forbid extra fields
    with pytest.raises(ValidationError):
        State(unknown_field="not_allowed")


def test_state_derived_day():
    state = State()
    state.update_derived_day(10)
    assert state.days_since_delivery is None

    state.item_delivered = True
    state.delivery_day = 5
    state.update_derived_day(5)
    assert state.days_since_delivery == 0

    state.update_derived_day(25)
    assert state.days_since_delivery == 20


def test_condition_tree_parsing_and_forbid_extra():
    # Leaf condition
    leaf = parse_condition_tree({
        "field": StateField.DAYS_SINCE_DELIVERY,
        "op": Operator.LTE,
        "value": 30,
    })
    assert isinstance(leaf, LeafCondition)
    assert leaf.field == StateField.DAYS_SINCE_DELIVERY

    # Extra field forbidden on leaf
    with pytest.raises(ValidationError):
        LeafCondition(
            field=StateField.DAYS_SINCE_DELIVERY,
            op=Operator.LTE,
            value=30,
            bogus_key="invalid",
        )

    # All condition
    tree_all = parse_condition_tree({
        "all": [
            {"field": "item_delivered", "op": "IS_TRUE", "value": True},
            {"field": "days_since_delivery", "op": "<=", "value": 30},
        ]
    })
    assert isinstance(tree_all, AllCondition)
    assert len(tree_all.all) == 2

    # Any condition
    tree_any = parse_condition_tree({
        "any": [
            {"field": "customer_tier", "op": "EQ", "value": "VIP"},
            {"field": "item_damaged", "op": "IS_TRUE", "value": True},
        ]
    })
    assert isinstance(tree_any, AnyCondition)
    assert len(tree_any.any) == 2


def test_rule_creation_and_validation():
    rule = Rule(
        id="test_rule",
        name="Test Rule",
        decision=DecisionType.REFUND,
        trigger=EventType.REFUND_REQUESTED,
        when={
            "all": [
                {"field": "days_since_delivery", "op": "LTE", "value": 30},
                {"field": "item_delivered", "op": "IS_TRUE", "value": True},
            ]
        },
        effect=EffectType.ALLOW,
        priority=1,
        overrides=["other_rule"],
        source=RuleSource(
            doc_name="Test Policy",
            verbatim_sentence="Test sentence for rule source.",
        ),
    )
    assert rule.id == "test_rule"
    assert rule.decision == DecisionType.REFUND
    assert rule.priority == 1
    assert rule.overrides == ["other_rule"]
    assert isinstance(rule.when, AllCondition)

    # Forbid invalid trigger
    with pytest.raises(ValidationError):
        Rule(
            id="bad_rule",
            name="Bad Rule",
            decision=DecisionType.REFUND,
            trigger="NON_EXISTENT_TRIGGER",
            when={"field": "days_since_delivery", "op": "LTE", "value": 30},
            effect=EffectType.ALLOW,
            source=RuleSource(doc_name="Doc", verbatim_sentence="Text"),
        )


def test_finding_structure():
    finding = Finding(
        type=FindingType.CONTRADICTION,
        severity=FindingSeverity.HIGH,
        rule_ids=["rule_1", "rule_2"],
        event_indices=[3],
        trace="Conflict detected between rule_1 and rule_2.",
    )
    assert finding.type == FindingType.CONTRADICTION
    assert finding.severity == FindingSeverity.HIGH
    assert finding.rule_ids == ["rule_1", "rule_2"]
    assert finding.event_indices == [3]
