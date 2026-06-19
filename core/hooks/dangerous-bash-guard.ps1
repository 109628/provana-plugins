# dangerous-bash-guard.ps1
# PreToolUse hook — blocks destructive shell commands before Claude executes them.
# Claude Code passes hook input as JSON on stdin.
# To block: write {"action": "block", "message": "..."} to stdout and exit 0.
# To allow: exit 0 with no stdout output.

$input = [Console]::In.ReadToEnd()

try {
    $payload = $input | ConvertFrom-Json
} catch {
    # Unparseable input — allow through (fail open)
    exit 0
}

$command = $payload.tool_input.command

if (-not $command) {
    exit 0
}

# Normalize for matching
$cmd = $command.Trim().ToLower()

$blocked = $null

# rm -rf / rm -r (recursive delete)
if ($cmd -match '\brm\s+-[a-z]*r[a-z]*f\b' -or $cmd -match '\brm\s+-[a-z]*f[a-z]*r\b') {
    $blocked = "rm -rf is blocked. Confirm the exact path with the user before running destructive deletes."
} elseif ($cmd -match '\brm\s+-r\b') {
    $blocked = "rm -r (recursive delete) is blocked. Confirm the exact path with the user."
}

# git reset --hard
elseif ($cmd -match '\bgit\s+reset\s+--hard\b') {
    $blocked = "git reset --hard is blocked — this discards uncommitted work permanently. Confirm with the user."
}

# git clean -f
elseif ($cmd -match '\bgit\s+clean\s+.*-f\b') {
    $blocked = "git clean -f is blocked — this permanently deletes untracked files. Confirm with the user."
}

# DROP TABLE / DROP DATABASE (SQL)
elseif ($cmd -match '\bdrop\s+(table|database)\b') {
    $blocked = "DROP TABLE / DROP DATABASE is blocked. Confirm the target and environment with the user before executing DDL drops."
}

# format c: (Windows disk format)
elseif ($cmd -match '\bformat\s+[a-z]:\b') {
    $blocked = "Disk format command is blocked. This would destroy all data on the volume."
}

# del /s (Windows recursive delete)
elseif ($cmd -match '\bdel\s+/s\b') {
    $blocked = "del /s (recursive Windows delete) is blocked. Confirm the target path with the user."
}

# kubectl delete without --namespace or -n flag (namespace-unscoped deletes are risky)
elseif ($cmd -match '\bkubectl\s+delete\b' -and $cmd -notmatch '\b(-n|--namespace)\b') {
    $blocked = "kubectl delete without an explicit --namespace flag is blocked. Specify -n <namespace> to scope the deletion."
}

if ($blocked) {
    $response = @{
        action  = "block"
        message = "WARNING Blocked: $blocked Confirm with user before running."
    } | ConvertTo-Json -Compress
    Write-Output $response
}

exit 0
