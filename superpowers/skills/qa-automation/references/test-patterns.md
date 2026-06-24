# QA Automation Patterns Reference
<!-- skills/qa-automation/references/test-patterns.md -->

## Visual regression testing

```python
# tests/e2e/test_visual_regression.py
# Catches unintended UI changes — screenshots diffed against approved baseline

@pytest.mark.asyncio
async def test_extraction_results_visual(page: Page):
    await page.goto("https://[app]/results/demo")
    await page.wait_for_load_state("networkidle")

    # Screenshot and compare against baseline
    await expect(page).to_have_screenshot(
        "extraction-results.png",
        threshold=0.1,          # 10% pixel difference tolerance
        animations="disabled"   # Freeze animations for stable screenshots
    )
```

**Baseline management:**
```bash
# Generate/update baselines (run before merging design changes)
pytest tests/e2e/test_visual_regression.py --update-snapshots

# CI: fail on any visual diff not pre-approved
pytest tests/e2e/test_visual_regression.py  # No flag = compare mode
```

---

## API contract testing (Playwright + direct API)

```python
# tests/e2e/test_api_contract.py
# Verifies UI and API agree on the same data model

@pytest.mark.asyncio
async def test_extraction_api_matches_ui(page: Page, api_client):
    # Submit via UI
    await page.goto("https://[app]/upload")
    await page.set_input_files("[data-testid='file-input']", "tests/fixtures/invoice.pdf")
    await page.click("[data-testid='submit']")
    job_id = await page.locator("[data-testid='job-id']").inner_text()

    # Fetch same result from API
    api_result = await api_client.get(f"/api/v1/extractions/{job_id}")

    # UI and API must show same values
    ui_vendor = await page.locator("[data-testid='field-vendor-name']").inner_text()
    assert ui_vendor == api_result["fields"]["vendor_name"]["value"]
```

---

## Network condition testing

```python
# Simulate poor network — tests that the UI handles latency gracefully
@pytest.mark.asyncio
async def test_upload_on_slow_network(page: Page, browser_context, test_invoice):
    # Simulate 3G network (750kb/s down, 250kb/s up, 100ms RTT)
    await browser_context.route("**/*", lambda route: route.continue_())
    cdp = await browser_context.new_cdp_session(page)
    await cdp.send("Network.emulateNetworkConditions", {
        "offline": False,
        "downloadThroughput": 750 * 1024 / 8,
        "uploadThroughput": 250 * 1024 / 8,
        "latency": 100
    })
    
    # Upload should still work, just with visible progress indicator
    await page.goto("https://[app]/upload")
    await page.set_input_files("[data-testid='file-input']", test_invoice)
    await page.click("[data-testid='submit']")
    
    # Progress bar must be visible on slow uploads
    await expect(page.locator("[data-testid='upload-progress']")).to_be_visible()
    await page.wait_for_selector("[data-testid='extraction-complete']", timeout=60_000)
```

---

## Mobile viewport testing

```python
# tests/e2e/conftest.py — add mobile fixture
@pytest.fixture
async def mobile_page(browser_context):
    page = await browser_context.new_page()
    await page.set_viewport_size({"width": 390, "height": 844})  # iPhone 14
    # Emulate touch
    await page.evaluate("""
        Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 5});
    """)
    yield page
    await page.close()

@pytest.mark.asyncio
async def test_upload_mobile_viewport(mobile_page):
    await mobile_page.goto("https://[app]/upload")
    # Tap — not click
    await mobile_page.tap("[data-testid='upload-button']")
    # Check mobile layout
    upload_zone = mobile_page.locator("[data-testid='drop-zone']")
    box = await upload_zone.bounding_box()
    assert box["width"] >= 300, "Drop zone too narrow on mobile"
```

---

## Parallel test execution

```python
# pytest.ini or pyproject.toml
[pytest]
addopts = -n auto  # requires pytest-xdist — auto-detects CPU count

# Or for Playwright specifically:
addopts = --numprocesses=4

# Each worker gets its own browser instance via conftest fixtures
# IMPORTANT: Use unique test data per worker to avoid collisions
```

---

## Test data management

```python
# tests/e2e/fixtures/data_factory.py
import uuid
from typing import dict

class TestDataFactory:
    """
    Generates unique test data per test run to avoid state collisions
    in parallel execution.
    """

    @staticmethod
    def unique_email() -> str:
        return f"test_{uuid.uuid4().hex[:8]}@provana-test.invalid"

    @staticmethod
    def invoice_fixture(vendor: str = "Test Vendor", 
                        amount: float = 1234.56) -> dict:
        return {
            "vendor": vendor,
            "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}",
            "amount": amount,
            "date": "2026-05-12"
        }

    @staticmethod
    def cleanup_test_data(api_client, created_ids: list):
        """Delete all test data created during the test. Called in teardown."""
        for id_ in created_ids:
            api_client.delete(f"/api/v1/test-data/{id_}")
```

---

## Flaky test detection and quarantine

```python
# pytest plugin: pytest-rerunfailures
# Run flaky tests up to 3 times before marking as failed
# Install: pip install pytest-rerunfailures

# Mark known-flaky tests for investigation
@pytest.mark.flaky(reruns=3, reruns_delay=1)
async def test_something_occasionally_flaky():
    ...

# In CI: quarantine flaky tests so they don't block merges
# but still alert the team
# Azure DevOps: use test result trending to identify flaky tests
```

---

## Screenshot and video evidence

```python
# Always capture on failure — required for QA sign-off at Provana

@pytest.fixture(autouse=True)
async def capture_on_failure(page: Page, request):
    yield
    if request.node.rep_call.failed:
        # Screenshot
        screenshot_path = f"reports/failures/{request.node.name}.png"
        await page.screenshot(path=screenshot_path, full_page=True)

        # Accessibility tree dump (helps debug selector issues)
        tree = await page.accessibility.snapshot()
        with open(f"reports/failures/{request.node.name}-a11y.json", "w") as f:
            import json
            json.dump(tree, f, indent=2)
```
