---
name: provana-langfuse-prompts
description: >
  Migrate hardcoded prompts from any Provana service to Langfuse prompt management.
  Creates Dev + QA versions under the standard naming convention and generates a
  prompt_service.py fetch helper. Use when user says "migrate prompts to Langfuse",
  "move prompts to Langfuse", or "create Langfuse prompts for this service".
---

# Provana Langfuse Prompt Migration

## Credentials

Self-hosted Langfuse instance. Credentials are in the service `.env`:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-539188ff-d78c-4236-af69-1ba5c098a556
LANGFUSE_SECRET_KEY=sk-lf-...          # read from .env, never print
LANGFUSE_HOST=https://langfuse-aiml.provana.com
```

Load with python-dotenv before making API calls. Never hardcode the secret key.

---

## Naming Convention

```
{Env}/{service-name}/{category}/{slug}
```

| Env token | When used |
|-----------|-----------|
| `Dev`     | `dev` environment (default) |
| `QA`      | `qa` environment |
| `UAT`     | `uat` environment (create if needed) |

**Examples from existing services:**
```
Dev/cc-post-call-analytics/score-card-analysis/variable-extraction-prompt
Dev/cc-livekit-agent/voice-agent-prompts/context-summarizer
QA/cc-livekit-agent/voice-agent-prompts/nudge-coach
```

**Rules:**
- `service-name` = repo/service slug, hyphenated, e.g. `cc-livekit-agent`, `cc-aiservices`, `cc-ai-nudge-service`
- `category` = logical group within service, e.g. `voice-agent-prompts`, `score-card-analysis`
- `slug` = short descriptor, hyphenated, e.g. `context-summarizer`, `outbound-greeting`
- Always create **both** `Dev/...` and `QA/...` versions
- Both get `labels: ["production"]` so `label="production"` fetch works in all envs

---

## Step 1 — Scan for Hardcoded Prompts

Search the codebase for:
```bash
grep -rn "instruction\|system_prompt\|generate_reply.*instructions\|ChatContext\|role.*system" \
  --include="*.py" --exclude-dir=".venv" .
```

Also check:
- `prompts/` folder (`.py` files with string constants)
- Inline strings in agent/service files near LLM calls

Build inventory:

| Slug | Source file | Content |
|------|-------------|---------|
| e.g. `context-summarizer` | `prompts/summarizer_prompt.py` | `SummarizerPrompt.instruction()` |

---

## Step 2 — Upload Prompts via REST API

Use this Python script (run from the service root with `uv run` or `python3`):

```python
import base64, json, urllib.request, urllib.error, urllib.parse
from dotenv import load_dotenv
import os

load_dotenv('.env')

pk = os.environ['LANGFUSE_PUBLIC_KEY']
sk = os.environ['LANGFUSE_SECRET_KEY']
host = os.environ.get('LANGFUSE_HOST', 'https://langfuse-aiml.provana.com')
auth = base64.b64encode(f'{pk}:{sk}'.encode()).decode()
hdrs = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'}

def create(name, prompt_text, prompt_type='text'):
    data = json.dumps({
        'name': name,
        'type': prompt_type,        # 'text' or 'chat'
        'prompt': prompt_text,
        'labels': ['production'],   # makes it fetchable immediately
    }).encode()
    req = urllib.request.Request(
        f'{host}/api/public/v2/prompts',
        data=data, headers=hdrs, method='POST'
    )
    try:
        with urllib.request.urlopen(req) as r:
            print(f'  OK   {name}')
    except urllib.error.HTTPError as e:
        print(f'  ERR  {name}: {e.code} {e.read().decode()[:120]}')

SERVICE  = 'cc-YOUR-SERVICE-NAME'    # ← change this
CATEGORY = 'your-category'           # ← change this

PROMPTS = {
    'your-slug': 'Your prompt text here.',
    # add more...
}

for slug, text in PROMPTS.items():
    for env in ('Dev', 'QA'):
        create(f'{env}/{SERVICE}/{CATEGORY}/{slug}', text)

print('Done.')
```

**To clone an existing prompt to QA:**
```python
def get_prompt(name):
    url = f'{host}/api/public/v2/prompts/{urllib.parse.quote(name, safe="")}?label=production'
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Fetch Dev version
p = get_prompt('Dev/cc-post-call-analytics/score-card-analysis/variable-extraction-prompt')

# Clone to QA
create(
    'QA/cc-post-call-analytics/score-card-analysis/variable-extraction-prompt',
    p['prompt'],
    p['type'],
)
```

---

## Step 3 — Create prompt_service.py

Add this file to `services/prompt_service.py` in the target service:

```python
# prompt_service.py
"""
Fetch prompts from Langfuse.
Naming: {Env}/{SERVICE}/{CATEGORY}/{slug}
Env resolved from LANGFUSE_TRACING_ENVIRONMENT setting.
"""

from langfuse import get_client
from config.settings import settings
from utils.logging_utils import StructuredLogger as slog  # adjust import to match service

SERVICE  = 'cc-YOUR-SERVICE-NAME'
CATEGORY = 'your-category'

_ENV_MAP = {
    'dev':  'Dev',
    'qa':   'QA',
    'uat':  'Dev',    # no UAT tier yet
    'prod': 'Dev',
}


def _env_prefix() -> str:
    env = (settings.langfuse_tracing_environment or 'dev').lower()
    return _ENV_MAP.get(env, 'Dev')


def get_prompt(slug: str, fallback: str = '') -> str:
    """Fetch a text prompt by slug. Falls back gracefully on error."""
    name = f'{_env_prefix()}/{SERVICE}/{CATEGORY}/{slug}'
    try:
        lf = get_client()
        prompt = lf.get_prompt(name, label='production', type='text')
        return prompt.compile()
    except Exception as e:
        slog.warning('Failed to fetch prompt from Langfuse',
                     prompt_name=name, error=str(e))
        return fallback
```

---

## Step 4 — Update Callers

Replace hardcoded strings:

```python
# BEFORE
instructions = "You are a real-time call coaching observer. ..."

# AFTER
from services.prompt_service import get_prompt
instructions = get_prompt("nudge-coach")
```

For system prompt injection based on provider/feature:
```python
block = get_prompt(f"tts-voice-rules-{active_provider}")  # empty string if not found
if block:
    sections.append(block)
```

---

## Step 5 — Verify

```bash
# Quick fetch test
python3 -c "
from dotenv import load_dotenv; load_dotenv('.env')
from langfuse import get_client
lf = get_client()
p = lf.get_prompt('Dev/cc-YOUR-SERVICE/{CATEGORY}/your-slug', label='production', type='text')
print(p.compile()[:200])
"
```

---

## Existing Provana Prompts (reference)

| Path | Service |
|------|---------|
| `Dev/cc-livekit-agent/voice-agent-prompts/context-summarizer` | LiveKit agent — context compaction |
| `Dev/cc-livekit-agent/voice-agent-prompts/nudge-coach` | LiveKit agent — real-time nudge |
| `Dev/cc-livekit-agent/voice-agent-prompts/tts-voice-rules-cartesia` | LiveKit agent — Cartesia voice |
| `Dev/cc-livekit-agent/voice-agent-prompts/tts-voice-rules-elevenlabs` | LiveKit agent — ElevenLabs voice |
| `Dev/cc-livekit-agent/voice-agent-prompts/user-away` | LiveKit agent — silence prompt |
| `Dev/cc-livekit-agent/voice-agent-prompts/outbound-greeting` | LiveKit agent — outbound greeting |
| `Dev/cc-post-call-analytics/score-card-analysis/variable-extraction-prompt` | Post-call analytics |
| `QA/*` | QA mirrors of all above |
