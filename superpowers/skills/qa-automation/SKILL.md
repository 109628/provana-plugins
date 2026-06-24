---
name: qa-automation
description: Comprehensive QA automation skill — generates Playwright browser tests, desktop automation via pyautogui/accessibility APIs, synthetic user simulation, and full regression harnesses. Mimics real human interaction patterns including think-time, misclicks, slow typing, and multi-step workflows. Works for web apps, desktop apps, voice UIs, and document processing pipelines. Trigger on "write tests", "automate QA", "playwright", "browser automation", "desktop automation", "UI testing", "end-to-end tests", "e2e", "simulate a user", "regression suite", "generate test cases", "test the UI", "functional testing", or any request involving automated verification of a user-facing interface.
---

# QA Automation — Human-Mimicking Test Generation

Generates production-grade automated tests that replicate real human interaction patterns — not just happy-path scripted clicks. Covers web (Playwright), desktop (pyautogui + accessibility), voice pipelines, and document processing.

**Announce at start:** "Running qa-automation. Designing test strategy."

## Core philosophy

Most automated tests fail to catch real bugs because they test the happy path at machine speed with perfect inputs. Real users:
- Type slowly and make mistakes
- Click in slightly wrong places
- Arrive via unexpected navigation paths
- Submit forms half-filled then go back
- Use keyboard shortcuts, copy-paste, and autofill
- Have network latency, slow devices, and distractions

Every test harness built by this skill simulates realistic human behaviour, not mechanical script execution.

---

## Step 1: Test strategy design

Before writing a single test, establish:

```
Test scope analysis:
  - What interface type? (web / desktop / voice / document upload)
  - What are the critical user journeys? (list 3–5 paths a real user takes)
  - What is the SLO? (latency, accuracy, availability)
  - What are the most likely failure modes? (not just happy path)
  - What data does the test need? (fixtures, test accounts, sample documents)
  - Where does the test run? (local, CI, staging, production-smoke)
  - Who owns test failures? (which team gets paged when this test fails in CI?)
```

Produce a test plan before writing code. The test plan is the contract.

---

## Playwright — Web and Browser Automation

### Setup

```bash
pip install playwright pytest-playwright pytest-asyncio
playwright install chromium firefox webkit
```

### Project structure

```
tests/
├── e2e/
│   ├── conftest.py              # Fixtures, browser setup, auth
│   ├── pages/                   # Page Object Model
│   │   ├── base_page.py
│   │   ├── login_page.py
│   │   └── [feature]_page.py
│   ├── journeys/                # Full user journeys (multi-page flows)
│   │   └── test_[journey].py
│   ├── components/              # Isolated component tests
│   └── fixtures/
│       ├── test_users.json
│       └── test_documents/
└── conftest.py
```

### Base conftest — realistic browser setup

```python
# tests/e2e/conftest.py
import pytest
import asyncio
from playwright.async_api import async_playwright, BrowserContext, Page
from typing import AsyncGenerator

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def browser_context() -> AsyncGenerator[BrowserContext, None]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,              # False for debugging
            slow_mo=50,                 # 50ms between actions — more realistic
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            timezone_id="America/New_York",
            # Simulate real network conditions
            # Use: context.set_offline(True) for offline tests
        )
        # Block analytics / tracking to reduce noise
        await context.route("**/(analytics|tracking|hotjar)/**", lambda r: r.abort())
        yield context
        await browser.close()

@pytest.fixture
async def page(browser_context: BrowserContext) -> AsyncGenerator[Page, None]:
    page = await browser_context.new_page()
    # Capture console errors — real users don't see them but QA should
    page.on("console", lambda msg: print(f"[Browser console {msg.type}]: {msg.text}") 
            if msg.type == "error" else None)
    page.on("pageerror", lambda err: pytest.fail(f"Uncaught browser error: {err}"))
    yield page
    await page.close()
```

### Page Object Model — realistic interaction helpers

```python
# tests/e2e/pages/base_page.py
import asyncio
import random
from playwright.async_api import Page, Locator

class BasePage:
    def __init__(self, page: Page):
        self.page = page

    async def human_type(self, locator: Locator, text: str, 
                          wpm: int = 60, error_rate: float = 0.02):
        """
        Types text at human speed with realistic typo-and-correct behaviour.
        wpm=60 is average typing speed. error_rate=0.02 = 2% of chars get a typo.
        """
        await locator.click()
        chars_per_second = (wpm * 5) / 60  # avg 5 chars per word
        delay_ms = int(1000 / chars_per_second)

        for char in text:
            if random.random() < error_rate:
                # Make a typo, pause, backspace, retype
                wrong_char = chr(ord(char) + random.choice([-1, 1]))
                await locator.type(wrong_char, delay=delay_ms)
                await asyncio.sleep(random.uniform(0.1, 0.3))  # Noticing mistake
                await self.page.keyboard.press("Backspace")
                await asyncio.sleep(random.uniform(0.05, 0.15))  # Correction pause

            await locator.type(char, delay=delay_ms + random.randint(-10, 30))

    async def human_click(self, locator: Locator, hesitation_ms: int = 200):
        """Click with realistic pre-click hesitation and slight position jitter."""
        await asyncio.sleep(random.uniform(0, hesitation_ms / 1000))
        box = await locator.bounding_box()
        if box:
            # Click slightly off-center — humans don't click pixel-perfect
            x = box["x"] + box["width"] / 2 + random.uniform(-3, 3)
            y = box["y"] + box["height"] / 2 + random.uniform(-3, 3)
            await self.page.mouse.click(x, y)
        else:
            await locator.click()

    async def human_scroll(self, direction: str = "down", distance: int = 300):
        """Scroll in steps like a human using a mouse wheel."""
        steps = random.randint(3, 6)
        per_step = distance // steps
        for _ in range(steps):
            delta = per_step + random.randint(-20, 20)
            await self.page.mouse.wheel(0, delta if direction == "down" else -delta)
            await asyncio.sleep(random.uniform(0.05, 0.15))

    async def wait_for_human_read_time(self, word_count: int, wpm: int = 250):
        """Wait the time a human would take to read N words at 250wpm."""
        read_time = (word_count / wpm) * 60
        await asyncio.sleep(read_time + random.uniform(0, 1))

    async def assert_no_console_errors(self):
        """Fail if any uncaught JS errors occurred during this page interaction."""
        # Errors are captured in conftest page fixture
        pass
```

### User journey test — document upload workflow

```python
# tests/e2e/journeys/test_document_upload_journey.py
import pytest
from playwright.async_api import Page, expect
from tests.e2e.pages.upload_page import UploadPage
from tests.e2e.pages.results_page import ResultsPage
import asyncio

class TestDocumentUploadJourney:
    """
    End-to-end journey: user uploads an invoice, reviews extraction results,
    corrects one field, and exports the data.
    Mirrors real QA analyst behaviour at a BPO.
    """

    @pytest.mark.asyncio
    async def test_invoice_upload_and_extraction(self, page: Page, 
                                                   test_invoice_pdf: str):
        upload = UploadPage(page)
        results = ResultsPage(page)

        # Navigate — user arrives from bookmark, not direct URL
        await page.goto("https://[app-url]/dashboard")
        await upload.navigate_to_upload_via_menu()  # Not direct URL nav

        # User reads the upload instructions before doing anything
        await upload.wait_for_human_read_time(word_count=40)

        # Upload the file — human drags to drop zone
        await upload.drag_and_drop_file(test_invoice_pdf)

        # Wait for processing — user watches spinner
        await results.wait_for_extraction_complete(timeout=30_000)

        # Check extraction results
        extracted = await results.get_extracted_fields()

        assert extracted["vendor_name"] is not None, "Vendor name not extracted"
        assert extracted["invoice_number"] is not None, "Invoice number not extracted"
        assert extracted["total_amount"] is not None, "Total amount not extracted"

        # Verify confidence indicators shown to user
        low_confidence_fields = await results.get_low_confidence_fields()
        for field in low_confidence_fields:
            assert await results.is_flagged_for_review(field), \
                f"Low confidence field '{field}' not flagged for human review"

        # User corrects a field (realistic: they catch one extraction error)
        await results.human_type(results.field_input("vendor_name"), 
                                   "Corrected Vendor Name")
        await results.human_click(results.save_button())

        # Verify save confirmation
        await expect(results.success_toast()).to_be_visible(timeout=5_000)

        # Export — user reads export options before choosing
        await results.wait_for_human_read_time(word_count=20)
        await results.export_as_json()

        # Verify download triggered
        download = await page.wait_for_event("download", timeout=10_000)
        assert download.suggested_filename.endswith(".json")

    @pytest.mark.asyncio
    async def test_upload_rejected_file_type(self, page: Page):
        """User tries to upload a .exe — should get a clear error message."""
        upload = UploadPage(page)
        await page.goto("https://[app-url]/upload")

        await upload.attempt_upload_file("tests/fixtures/malicious.exe")
        error = upload.error_message()
        await expect(error).to_be_visible(timeout=3_000)
        await expect(error).to_contain_text("not supported")

    @pytest.mark.asyncio
    async def test_session_timeout_during_upload(self, page: Page, 
                                                    test_invoice_pdf: str):
        """User's session expires mid-upload — should redirect to login gracefully."""
        upload = UploadPage(page)
        await page.goto("https://[app-url]/upload")
        await upload.drag_and_drop_file(test_invoice_pdf)

        # Simulate session expiry
        await page.evaluate("document.cookie = 'session=expired; max-age=0'")

        # Trigger an action that requires auth
        await upload.submit_upload()

        # Should redirect to login, NOT show a confusing error
        await page.wait_for_url("**/login**", timeout=10_000)
        await expect(page.locator("[data-testid='session-expired-message']"))\
            .to_be_visible()
```

### Accessibility testing integrated into Playwright

```python
# tests/e2e/test_accessibility.py
from playwright.async_api import Page
from axe_playwright_python import Axe

@pytest.mark.asyncio
async def test_upload_page_wcag_aa(page: Page):
    """All pages must pass WCAG 2.1 AA — fail the PR if they don't."""
    await page.goto("https://[app-url]/upload")
    axe = Axe()
    results = await axe.run(page)
    violations = [v for v in results.violations if v["impact"] in ("critical", "serious")]
    assert len(violations) == 0, \
        f"WCAG violations found:\n" + \
        "\n".join(f"  [{v['impact']}] {v['id']}: {v['description']}" 
                  for v in violations)
```

---

## Desktop Automation — pyautogui + Accessibility APIs

For desktop apps, Electron apps, or thick-client interfaces that Playwright can't reach.

### Setup

```bash
pip install pyautogui pyperclip pillow pywinauto  # Windows
pip install pyautogui pyperclip pillow pyobjc     # macOS (Accessibility API)
pip install pyautogui pyperclip pillow atspi      # Linux (AT-SPI)
```

### Desktop automation base class

```python
# tests/desktop/base_desktop.py
import pyautogui
import pyperclip
import time
import random
import subprocess
from PIL import ImageGrab
from pathlib import Path

# Safety: pyautogui failsafe — move mouse to corner to stop
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05  # 50ms between actions (human-like)

class DesktopAutomation:
    """
    Human-mimicking desktop automation.
    Uses image recognition + accessibility APIs where available.
    Falls back to coordinate-based interaction only as last resort.
    """

    def human_type(self, text: str, wpm: int = 55):
        """Type at realistic human speed with natural variation."""
        cps = (wpm * 5) / 60
        interval = 1.0 / cps
        for char in text:
            pyautogui.typewrite(char, interval=interval + random.uniform(-0.02, 0.05))

    def human_click(self, image_path: str = None, x: int = None, y: int = None,
                     confidence: float = 0.85):
        """
        Click a UI element by image recognition (preferred) or coordinates (fallback).
        Adds pre-click hesitation and slight position noise.
        """
        if image_path:
            location = pyautogui.locateCenterOnScreen(image_path, confidence=confidence)
            if not location:
                raise AssertionError(f"UI element not found on screen: {image_path}")
            # Add human jitter
            x = location.x + random.randint(-3, 3)
            y = location.y + random.randint(-3, 3)

        time.sleep(random.uniform(0.1, 0.3))  # Pre-click hesitation
        pyautogui.moveTo(x, y, duration=random.uniform(0.2, 0.5))
        pyautogui.click()
        time.sleep(random.uniform(0.05, 0.2))  # Post-click pause

    def wait_for_element(self, image_path: str, timeout: float = 10.0,
                          confidence: float = 0.85) -> bool:
        """Poll for a UI element to appear (replaces Playwright's wait_for_selector)."""
        start = time.time()
        while time.time() - start < timeout:
            if pyautogui.locateOnScreen(image_path, confidence=confidence):
                return True
            time.sleep(0.25)
        return False

    def screenshot(self, name: str, output_dir: str = "reports/screenshots"):
        """Capture and save screenshot for test evidence."""
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        path = f"{output_dir}/{name}_{int(time.time())}.png"
        ImageGrab.grab().save(path)
        return path

    def paste_text(self, text: str):
        """Paste text via clipboard — faster than typing for long inputs."""
        pyperclip.copy(text)
        pyautogui.hotkey("ctrl", "v")

    def keyboard_shortcut(self, *keys, pause_after: float = 0.3):
        """Press keyboard shortcut with post-action pause."""
        pyautogui.hotkey(*keys)
        time.sleep(pause_after)
```

### Windows accessibility API (pywinauto — more reliable than image recognition)

```python
# tests/desktop/windows_automation.py
from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys
import time

class WindowsAppAutomation:
    """
    Use Windows UI Automation (UIA) tree — finds elements by role/name,
    not pixel coordinates. Survives window moves and DPI changes.
    """

    def __init__(self, app_exe: str):
        self.app = Application(backend="uia").start(app_exe)
        time.sleep(2)  # Wait for app to initialize

    def find_by_name(self, name: str, control_type: str = "Button"):
        """Find control by accessible name — preferred over image matching."""
        return self.app.window().child_window(title=name, control_type=control_type)

    def find_by_automation_id(self, automation_id: str):
        """Find by AutomationId — most stable selector, survives text changes."""
        return self.app.window().child_window(auto_id=automation_id)

    def fill_form_field(self, field_name: str, value: str):
        field = self.find_by_name(field_name, "Edit")
        field.set_focus()
        field.type_keys(value, with_spaces=True, pause=0.05)

    def assert_text_present(self, text: str, timeout: float = 5.0):
        import time
        start = time.time()
        while time.time() - start < timeout:
            try:
                self.app.window().child_window(title=text)
                return True
            except:
                time.sleep(0.2)
        raise AssertionError(f"Text not found in app: {text}")

    def get_accessibility_tree(self) -> dict:
        """Dump full accessibility tree — useful for discovering element IDs."""
        return self.app.window().print_control_identifiers()
```

---

## Synthetic User Simulation

Generates realistic multi-turn user behaviour, not just single-action scripts.

```python
# tests/synthetic/user_simulator.py
import asyncio
import random
from dataclasses import dataclass
from typing import List, Callable, Any
from enum import Enum

class UserPersona(Enum):
    POWER_USER = "power_user"       # Fast, keyboard shortcuts, knows the system
    NOVICE = "novice"               # Slow, reads everything, hesitates
    DISTRACTED = "distracted"       # Starts actions, pauses, comes back
    MOBILE_USER = "mobile_user"     # Slower, fat-finger errors, pinch-zoom
    FRUSTRATED = "frustrated"       # Retries, back-navigates, rage-clicks

@dataclass
class UserAction:
    name: str
    fn: Callable
    args: list
    think_time_ms: tuple  # (min, max) think time before this action

class SyntheticUser:
    """
    Simulates a user persona interacting with the application.
    Adds realistic timing, errors, and behaviour patterns per persona.
    """

    PERSONA_PARAMS = {
        UserPersona.POWER_USER:   {"type_wpm": 80,  "think_time": (50, 200),   "error_rate": 0.01},
        UserPersona.NOVICE:       {"type_wpm": 30,  "think_time": (500, 2000), "error_rate": 0.05},
        UserPersona.DISTRACTED:   {"type_wpm": 50,  "think_time": (100, 5000), "error_rate": 0.03},
        UserPersona.MOBILE_USER:  {"type_wpm": 25,  "think_time": (300, 1000), "error_rate": 0.08},
        UserPersona.FRUSTRATED:   {"type_wpm": 60,  "think_time": (50, 300),   "error_rate": 0.04},
    }

    def __init__(self, persona: UserPersona, page):
        self.persona = persona
        self.page = page
        self.params = self.PERSONA_PARAMS[persona]

    async def think(self, action_name: str = ""):
        """Simulate think time before an action."""
        min_ms, max_ms = self.params["think_time"]
        if self.persona == UserPersona.DISTRACTED and random.random() < 0.1:
            # 10% chance of a long distraction
            await asyncio.sleep(random.uniform(3, 8))
        else:
            await asyncio.sleep(random.uniform(min_ms, max_ms) / 1000)

    async def type(self, locator, text: str):
        """Type with persona-specific speed and error rate."""
        await self.think()
        wpm = self.params["type_wpm"]
        error_rate = self.params["error_rate"]
        cps = (wpm * 5) / 60
        for char in text:
            if random.random() < error_rate:
                await locator.type(chr(ord(char) + 1))
                await asyncio.sleep(0.2)
                await self.page.keyboard.press("Backspace")
            await locator.type(char, delay=int(1000 / cps))

    async def run_journey(self, actions: List[UserAction]):
        """Execute a sequence of actions with persona-appropriate pacing."""
        for action in actions:
            min_ms, max_ms = action.think_time_ms
            await asyncio.sleep(random.uniform(min_ms, max_ms) / 1000)

            if self.persona == UserPersona.FRUSTRATED and random.random() < 0.15:
                # Frustrated user navigates back first
                await self.page.go_back()
                await asyncio.sleep(0.5)
                await self.page.go_forward()

            await action.fn(*action.args)

        # Generate usage report
        return {
            "persona": self.persona.value,
            "actions_completed": len(actions),
            "total_think_time": sum(
                random.uniform(*a.think_time_ms) for a in actions
            ) / 1000
        }
```

---

## CI Integration

```yaml
# .github/workflows/e2e.yml  (or Azure DevOps equivalent)
# Azure DevOps pipeline: azure-pipelines-e2e.yml
trigger:
  branches:
    include: ["feature/*", "fix/*"]

pool:
  vmImage: ubuntu-latest

steps:
  - script: |
      pip install playwright pytest-playwright pytest-asyncio axe-playwright-python
      playwright install --with-deps chromium
    displayName: "Install Playwright"

  - script: |
      pytest tests/e2e/ -v \
        --screenshot=on-failure \
        --video=on-failure \
        --tracing=retain-on-failure \
        --output=reports/playwright/ \
        -x   # Stop on first failure — fast feedback
    displayName: "Run E2E tests"

  - task: PublishTestResults@2
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: "reports/playwright/*.xml"

  - task: PublishPipelineArtifact@1
    condition: failed()
    inputs:
      targetPath: reports/playwright/
      artifact: playwright-failure-artifacts
```

---

## Test generation workflow

When this skill is invoked for a new feature:

1. Read the story ACs from `docs/story-NNN.md`
2. Classify each AC: web UI / desktop / voice / API / document
3. For each AC, generate:
   - Happy path test (primary scenario)
   - Sad path test (error / rejection scenario)
   - Edge case test (boundary, empty, oversized input)
   - Persona test (run the happy path as NOVICE and FRUSTRATED user)
4. Generate fixture data required
5. Write all test files to `tests/e2e/` or `tests/desktop/`
6. Run `pytest tests/e2e/ -v --collect-only` to verify test discovery
7. Run `bash hooks/post-test.sh` to verify CI gate

See `references/test-patterns.md` for additional patterns: visual regression, API contract testing, load testing integration, and mobile viewport testing.
