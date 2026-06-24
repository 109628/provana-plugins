---
name: provana-tdd
description: Use whenever writing ANY code in a Provana project. This is a rigid skill — follow exactly, no adaptation. Enforces RED → GREEN → REFACTOR → COMMIT for all implementation, including mid-sprint changes, bug fixes, hotfixes, and "trivial" one-liners. Trigger on "write code", "implement", "fix", "add a function", "create a class", "update this method", or any time code is about to be written. If code was written before a test existed, delete it and start over.
---

# Provana TDD

This is the Provana-specific implementation of `superpowers:test-driven-development`. It is a **rigid skill** — it does not flex for "simple" cases, deadlines, or any other rationalisation. The Provana delivery model depends on TDD because AI-generated code has a measurably higher logic error rate than human-reviewed code. Tests are the evidence that the code does what the spec says.

**Announce at start:** "Running provana-tdd. Writing the failing test first."

## The only allowed sequence

```
1. Write the failing test
2. Run it → confirm RED
3. Write minimal implementation
4. Run tests → confirm GREEN
5. Refactor if needed → tests still GREEN
6. Commit
```

There is no step 0 where you write the implementation first. If you find implementation code without a test, delete the implementation and start at step 1.

## Test structure by pod

### Pod 1 — Conv.AI / LiveKit Voice

```python
# tests/conv_ai/test_[feature].py
import pytest
from src.conv_ai.agents.[module] import [AgentClass]
from tests.harness.voice_simulator import VoiceSimulator

class Test[Feature]:
    def test_[specific_turn_behavior](self):
        """[AC reference: story-NNN AC2]"""
        # Arrange
        simulator = VoiceSimulator(persona="default_caller")
        agent = [AgentClass](config=test_config)
        # Act
        response = agent.handle_turn(simulator.say("[utterance]"))
        # Assert
        assert response.intent == "[expected_intent]"
        assert response.escalation_triggered == False
        assert response.latency_ms < 500  # Provana SLO

    def test_escalation_path(self):
        """Verify escalation triggers correctly"""
        simulator = VoiceSimulator(persona="frustrated_caller")
        agent = [AgentClass](config=test_config)
        response = agent.handle_turn(simulator.say("I want to speak to a human"))
        assert response.escalation_triggered == True
        assert response.transfer_target is not None
```

### Pod 2 — Doc.AI extraction

```python
# tests/doc_ai/test_[feature].py
import pytest
from src.doc_ai.extractors.[name]_extractor import [ExtractorClass]

class Test[Feature]:
    def test_extracts_[field]_from_[doc_type](self, sample_doc_fixture):
        """[AC reference: story-NNN AC1]"""
        extractor = [ExtractorClass]()
        result = extractor.extract(sample_doc_fixture)
        assert result.[field] == expected_value
        assert result.confidence >= 0.85  # Provana accuracy SLO

    def test_handles_missing_[field](self, incomplete_doc_fixture):
        """Edge case: field not present in document"""
        extractor = [ExtractorClass]()
        result = extractor.extract(incomplete_doc_fixture)
        assert result.[field] is None
        assert result.missing_fields == ["[field]"]
```

### Pod 3 — BPM / Process Automation

```python
# tests/bpm/test_[feature].py
import pytest
from src.bpm.agents.sop_[name]_agent import SOP[Name]Agent

class Test[Feature]:
    def test_[process_step]_follows_sop(self, sop_fixture):
        """[AC reference: story-NNN AC3]"""
        agent = SOP[Name]Agent(sop=sop_fixture)
        result = agent.execute_step("[step_name]", context=test_context)
        assert result.compliant_with_sop == True
        assert result.judgment_required == False  # deterministic step

    def test_[process_step]_flags_judgment_point(self, edge_case_fixture):
        """Verify agent surfaces judgment points to human"""
        agent = SOP[Name]Agent(sop=sop_fixture)
        result = agent.execute_step("[step_name]", context=edge_case_fixture)
        assert result.judgment_required == True
        assert result.human_prompt is not None
```

## Provana SLOs embedded in tests

Always include SLO assertions where applicable:

| Domain | Metric | Threshold |
|--------|--------|-----------|
| Conv.AI | Turn latency | < 500ms |
| Conv.AI | Intent accuracy | > 90% on test set |
| Doc.AI | Extraction accuracy | > 85% per field |
| Doc.AI | Missed fields rate | < 5% |
| BPM | Deterministic step accuracy | 100% |
| All | Hallucination rate | 0% on ground-truth set |

## Commit after each green test

Do not batch multiple test passes into one commit. Each AC gets its own commit:

```bash
git add tests/[path]/test_[feature].py src/[path]/[module].py
git commit -m "test([pod-scope]): [what the test verifies]"
# then after implementation passes:
git commit -m "feat([pod-scope]): [what was implemented]"
```

## Red flag rationalisations — stop immediately if you think these

| Thought | Reality |
|---------|---------|
| "This is just a simple utility function" | Simple functions are where bugs hide. RED first. |
| "I wrote the implementation and it looks right" | Delete it. You need a failing test first. |
| "The voice harness is slow, I'll skip it" | The harness exists for exactly this reason. Run it. |
| "This is a hotfix, no time for tests" | A hotfix without a test causes the next incident. |
| "PM/QA will test this anyway" | PM/QA verifies intent. You verify behaviour. Both required. |
| "The extraction logic is obvious" | Extraction logic that looks obvious has 40% field miss rates. Write the test. |

## After all tests pass

Run the full test suite — not just the new tests:

```bash
pytest tests/ -v --tb=short
```

Check coverage delta. If coverage dropped, the post-test.sh hook will block the merge. Add tests until it's restored.

Invoke `provana-superpowers:requesting-provana-review` before marking any story task as done.
