# pre-commit-quality-gate.ps1
# Triggered on UserPromptSubmit. Detects commit-intent prompts and runs quality checks.
# Blocks the prompt if checks fail — user must fix before Claude proceeds.

param()

# Read hook input from stdin
$inputJson = $null
try {
    $inputJson = $input | ConvertFrom-Json
} catch {
    exit 0  # malformed input = fail open
}

$prompt = $inputJson.prompt
if (-not $prompt) { exit 0 }

# Only trigger on commit-intent prompts
$commitPatterns = @(
    'commit',
    'push to',
    'create pr',
    'open pr',
    'pull request',
    'git push',
    'ready to merge'
)

$isCommitIntent = $false
foreach ($pattern in $commitPatterns) {
    if ($prompt -imatch $pattern) {
        $isCommitIntent = $true
        break
    }
}

if (-not $isCommitIntent) { exit 0 }

# Detect project type
$cwd = Get-Location
$isPython = (Test-Path "$cwd\pyproject.toml") -or (Test-Path "$cwd\requirements.txt")
$isNode   = (Test-Path "$cwd\package.json")
$isBoth   = $isPython -and $isNode

$failures = @()

# Python checks
if ($isPython) {
    # Ruff lint
    $ruff = Get-Command ruff -ErrorAction SilentlyContinue
    if ($ruff) {
        $result = & ruff check . --quiet 2>&1
        if ($LASTEXITCODE -ne 0) {
            $failures += "Ruff lint failed. Run: ruff check . --fix"
        }
    }

    # Mypy type check
    $mypy = Get-Command mypy -ErrorAction SilentlyContinue
    if ($mypy) {
        $result = & mypy . --ignore-missing-imports --quiet 2>&1
        if ($LASTEXITCODE -ne 0) {
            $failures += "Mypy type check failed. Run: mypy . --ignore-missing-imports"
        }
    }

    # Pytest with coverage threshold
    $pytest = Get-Command pytest -ErrorAction SilentlyContinue
    if ($pytest) {
        $result = & pytest --tb=no -q --co 2>&1
        if ($LASTEXITCODE -eq 0) {
            $result = & pytest --tb=short -q --cov=. --cov-fail-under=70 2>&1
            if ($LASTEXITCODE -ne 0) {
                $failures += "pytest failed or coverage below 70%. Run: pytest --cov=. --cov-report=term-missing"
            }
        }
    }
}

# Node/TypeScript checks
if ($isNode) {
    $pkg = Get-Content "$cwd\package.json" | ConvertFrom-Json

    # ESLint
    if ($pkg.scripts.lint) {
        $result = & npm run lint --silent 2>&1
        if ($LASTEXITCODE -ne 0) {
            $failures += "ESLint failed. Run: npm run lint"
        }
    }

    # TypeScript type check
    if ($pkg.scripts.'type-check' -or (Test-Path "$cwd\tsconfig.json")) {
        $tsc = Get-Command tsc -ErrorAction SilentlyContinue
        if ($tsc) {
            $result = & tsc --noEmit --quiet 2>&1
            if ($LASTEXITCODE -ne 0) {
                $failures += "TypeScript type check failed. Run: tsc --noEmit"
            }
        }
    }

    # Jest/Vitest
    if ($pkg.scripts.test) {
        $result = & npm test -- --passWithNoTests --silent 2>&1
        if ($LASTEXITCODE -ne 0) {
            $failures += "Tests failed. Run: npm test"
        }
    }
}

# Result
if ($failures.Count -eq 0) { exit 0 }

$message = "Quality gate failed before commit:`n"
foreach ($f in $failures) {
    $message += "  - $f`n"
}
$message += "`nFix the issues above, then retry your commit."

$output = @{
    action  = "block"
    message = $message
} | ConvertTo-Json -Compress

Write-Output $output
exit 0
