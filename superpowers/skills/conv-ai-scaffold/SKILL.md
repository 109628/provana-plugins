---
name: conv-ai-scaffold
description: Use for all Pod 1 Conv.AI and LiveKit Voice work at Provana. Scaffolds STT/TTS/LLM pipelines, defines voice personas with escalation rules, generates conversation flow specs, sets up the voice test harness, and produces regression test suites from accepted call recordings. Trigger on "conv.ai", "livekit", "voice", "conversation flow", "voice bot", "STT", "TTS", "voice agent", "call flow", "escalation path", "voice persona", or any Pod 1 delivery work.
---

# Conv.AI Scaffold

Pod 1 domain skill. Covers the full technical delivery surface for Conv.AI and LiveKit Voice products.

**Announce at start:** "Running conv-ai-scaffold for Pod 1 (Conv.AI / LiveKit Voice) work."

## What this skill covers

- STT/TTS/LLM pipeline scaffolding
- Voice persona definition (tone, escalation rules, fallback handling)
- Conversation flow specification (intent map, happy/unhappy paths)
- Voice test harness setup (simulated caller, turn evaluation)
- Voice quality rubric (latency, accuracy, naturalness scoring)
- Regression test generation from accepted call recordings

## Pipeline scaffold

Standard Provana Conv.AI pipeline structure:

```python
# src/conv_ai/pipelines/[name]_pipeline.py
from src.conv_ai.core.stt import STTEngine
from src.conv_ai.core.tts import TTSEngine
from src.conv_ai.core.llm import LLMOrchestrator
from src.conv_ai.core.session import ConversationSession

class [Name]Pipeline:
    """
    [Product name] conversation pipeline.
    SLOs: turn latency < 500ms, intent accuracy > 90%
    """
    def __init__(self, config: PipelineConfig):
        self.stt = STTEngine(config.stt)
        self.tts = TTSEngine(config.tts)
        self.llm = LLMOrchestrator(config.llm)
        self.session = ConversationSession()

    def handle_turn(self, audio_input: bytes) -> TurnResponse:
        transcript = self.stt.transcribe(audio_input)
        intent = self.llm.classify_intent(transcript, self.session.context)
        response_text = self.llm.generate_response(intent, self.session.context)
        audio_output = self.tts.synthesize(response_text)
        self.session.update(transcript, intent, response_text)
        return TurnResponse(
            audio=audio_output,
            text=response_text,
            intent=intent,
            latency_ms=self._measure_latency(),
            escalation_triggered=intent.requires_escalation
        )
```

## Voice persona definition

Before implementing any pipeline, define the persona:

```yaml
# src/conv_ai/personas/[name]_persona.yaml
name: [persona_name]
product: [product_name]

tone:
  style: [professional|friendly|empathetic]
  formality: [formal|semi-formal|casual]
  pacing: [measured|normal|brisk]

opening_greeting: "[exact greeting text]"

escalation_rules:
  - trigger: "frustrated_caller"
    condition: "sentiment_score < 0.3 for 2 consecutive turns"
    action: transfer_to_human
    message: "[transfer acknowledgement text]"
  - trigger: "explicit_request"
    condition: "intent == 'speak_to_human'"
    action: transfer_to_human
    message: "[transfer acknowledgement text]"
  - trigger: "unknown_intent_loop"
    condition: "unknown_intent for 3 consecutive turns"
    action: transfer_to_human
    message: "[graceful handoff text]"

fallback_responses:
  unknown_intent: "[friendly clarification request]"
  technical_error: "[graceful error message]"
  timeout: "[timeout handling message]"
```

## Conversation flow spec

Map every intent to its happy and unhappy paths:

```markdown
# [Product] Conversation Flow Spec

## Intent map
| Intent | Trigger utterances | Happy path | Unhappy path |
|--------|-------------------|------------|--------------|
| [intent_1] | "[example 1]", "[example 2]" | [response flow] | [fallback] |

## Turn sequence diagrams
### Happy path: [primary_use_case]
Caller: "[opening]"
→ STT: transcribe
→ LLM: classify as [intent], confidence 0.92
→ LLM: generate response
→ TTS: synthesise
Agent: "[response]"
...

### Escalation path
[sequence showing escalation trigger and transfer]
```

## Voice test harness

```python
# tests/harness/voice_simulator.py
class VoiceSimulator:
    """Simulates caller behaviour for Conv.AI testing."""

    PERSONAS = {
        "default_caller": {"sentiment": 0.7, "patience": 0.8},
        "frustrated_caller": {"sentiment": 0.2, "patience": 0.2},
        "elderly_caller": {"pace": "slow", "repetition_rate": 0.3},
        "technical_caller": {"vocabulary": "precise", "tolerance_for_error": 0.9},
    }

    def say(self, utterance: str, persona: str = "default_caller") -> AudioInput:
        """Synthesise caller utterance as audio input for pipeline testing."""
        ...

    def evaluate_turn(self, response: TurnResponse, expected: TurnExpectation) -> TurnScore:
        """Score a pipeline response against expected behaviour."""
        return TurnScore(
            intent_correct=response.intent == expected.intent,
            latency_ok=response.latency_ms < expected.max_latency_ms,
            escalation_correct=response.escalation_triggered == expected.should_escalate,
            naturalness=self._score_naturalness(response.text),
        )
```

## Voice quality rubric

PM/QA uses this for every story AC verification:

| Metric | Measurement method | Pass threshold |
|--------|-------------------|----------------|
| Turn latency | `response.latency_ms` | < 500ms |
| Intent accuracy | Test set of 50+ turns | > 90% correct |
| Escalation accuracy | Escalation test set | 100% on explicit requests |
| TTS naturalness | MOS score via voice_quality_rubric skill | > 3.5/5 |
| Fallback rate | % turns hitting fallback | < 15% |

## Regression test generation

When accepted call recordings exist:

```python
# tools/regression_gen.py
"""
Generates regression test cases from accepted call recordings.
Usage: python tools/regression_gen.py --recordings path/to/recordings/ --output tests/conv_ai/regression/
"""
```

For each accepted call:
1. Transcribe with STT
2. Label intents manually (PM/QA does this)
3. Generate test case asserting same intent classification
4. Add to regression suite

## Handoff to Kiran's team

When Conv.AI product reaches go-live, the handoff package includes:
- Persona YAML files
- Conversation flow specs
- Voice test harness + regression suite
- Voice quality rubric (PM/QA annotated)
- LLMOps runbook for latency/accuracy monitoring
- Observability config for turn-level tracing

Invoke `provana-superpowers:finishing-provana-branch` to package this.
