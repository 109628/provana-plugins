# Architecture Reference

## System overview

proctl is a Node.js CLI with minimal dependencies: `commander` for argument parsing,
`inquirer` for interactive prompts. It fetches plugin manifests from GitHub or local dirs,
parses them, and routes components to agent-specific config locations.

**Platform: Windows.** All file paths must use `path.join(os.homedir(), ...)`.
Never use `~` expansion or hardcoded `/home/user` paths. Hook scripts are `.ps1`.

## Data flow

```
User runs: proctl add 109628/provana-core --skill git-workflow -a claude

1. CLI parses args → { source: "109628/provana-core",
                        components: { skills: ["git-workflow"] },
                        agents: ["claude-code"] }

2. Registry resolver:
   "109628/provana-core"
   → tries: https://raw.githubusercontent.com/109628/provana-core/main/plugin.json
   → fallback: /HEAD/plugin.json, then /master/plugin.json
   → returns: parsed manifest object + fetchFile(relativePath) function

3. Manifest parser:
   → validates manifest against schema
   → filters to requested components: { skills: { "git-workflow": {...} } }
   → checks agent compatibility: claude-code supports skills? yes

4. Installer orchestrator:
   → for each component type in filtered manifest:
       → calls component installer with agent adapter

5. Skill installer (components/skills.js):
   → fetches SKILL.md from GitHub via fetchFile
   → calls agentAdapter.installSkill("git-workflow", { "SKILL.md": content }, opts)

6. Claude Code adapter (agents/claude-code.js):
   → copies SKILL.md to path.join(os.homedir(), '.claude', 'skills', 'git-workflow', 'SKILL.md')
   → no settings.json changes needed for skills

7. State tracker:
   → writes to path.join(os.homedir(), '.claude', 'proctl', 'state.json'):
     {
       "provana-core": {
         "source": "109628/provana-core",
         "version": "1.0.0",
         "installedAt": "2026-06-18T...",
         "components": { "skills": ["git-workflow"] },
         "agents": ["claude-code"]
       }
     }
```

## Module specifications

### bin/proctl.js

Entry point. Responsibilities:
- Commander.js program with `add`, `remove`, `list`, `update`, `init`,
  `skill`, `mcp`, `hook`, `registry` subcommands
- Global flags: `--verbose`, `--dry-run`, `--yes`
- Catch unhandled errors → print clean message → exit 1 (no stack traces unless --verbose)

### bin/proctl.cmd (Windows wrapper)

```
@echo off
node "%~dp0proctl.js" %*
```

Must be in the same directory as `proctl.js`. The `package.json` `bin` field points to
`proctl.js` — npm creates the `.cmd` wrapper automatically on Windows. No extra work needed;
just ensure the entry point works on Windows paths.

### lib/registry.js

```js
class Registry {
  constructor(registriesConfigPath)
    // registriesConfigPath = path.join(os.homedir(), '.claude', 'proctl', 'registries.json')

  async resolve(source) → { manifest, fetchFile(relativePath) → Buffer }
    // source can be: 'owner/repo', 'alias/name', 'https://...', './local/path'

  _parseSource(source) → { type: 'github'|'local'|'alias', owner?, repo?, alias?, name?, path? }
  async _resolveAlias(alias, name) → resolves alias from registries.json → delegates to _resolveGitHub
  async _resolveGitHub(owner, repo, token?) → { manifest, fetchFile }
    // tries main, HEAD, master branches in order
    // uses PROCTL_GITHUB_TOKEN env var if set (for private repos)
  async _resolveLocal(dirPath) → { manifest, fetchFile }

  async listPlugins(source) → [{ name, description, version }]
    // for multi-plugin repos: lists each subdirectory with plugin.json

  addRegistry(alias, url, token?)
    // appends to registries.json: { "alias": { url, token? } }
}
```

Environment variables:
- `PROCTL_GITHUB_TOKEN` — GitHub PAT for private repos
- `PROCTL_HOME` — override state dir (default: `~/.claude/proctl/`)

### lib/manifest.js

```js
class Manifest {
  constructor(raw)            // parse JSON + validate

  name → string
  version → string
  description → string
  components → { skills, mcp_servers, hooks, commands, statusline }

  filter({ skills?, mcp?, hooks?, commands?, onlyTypes? }) → Manifest (subset)
    // onlyTypes: ['skills', 'mcp'] filters to only those component types

  listSkills() → [{ name, description }]
  listMcpServers() → [{ name, description }]
  listHooks() → [{ name, event, description }]
  listCommands() → [{ name }]
  hasStatusline() → bool

  supportsAgent(agentName) → bool
  agentCapabilities(agentName) → { skills, mcp, hooks, commands, statusline }

  static validate(raw) → { valid: bool, errors: string[] }
    // returns ALL errors at once (never stop at first)
}
```

### lib/installer.js

```js
class Installer {
  constructor(registry, stateTracker)

  async install(source, options) {
    // options: { plugin?, skills?, mcp?, hooks?, commands?, statusline?,
    //            onlyTypes?, agents?, global?, yes?, dryRun? }
    // 1. Resolve manifest from registry
    // 2. If multi-plugin repo and no --plugin: prompt user (unless --yes + single option)
    // 3. Filter manifest to requested components
    // 4. If no agents specified: detect installed agents, prompt user
    // 5. For each selected agent:
    //    a. Get adapter, check capabilities
    //    b. Warn about unsupported component types (never error)
    //    c. Backup settings file
    //    d. For each supported component:
    //       - Fetch files via registry.fetchFile
    //       - Call component installer
    //    e. Update state tracker
    // 6. Print success summary
  }

  async remove(pluginName, options) {
    // 1. Look up plugin in state
    // 2. Determine components to remove (all unless specific flags)
    // 3. For each agent the plugin was installed to:
    //    a. Backup settings
    //    b. Call adapter remove methods
    // 4. Update state (remove component or whole entry if nothing left)
  }

  async update(pluginName, options) {
    // 1. Lookup source from state
    // 2. Resolve latest manifest, compare versions
    // 3. Remove old → install new
  }

  // Standalone installs (no plugin.json)
  async installStandaloneSkill(source, agentName, opts)
    // Creates implicit state entry: __standalone__skill__<name>

  async installStandaloneMcp(name, commandOrUrl, env, agentName, opts)
  async installStandaloneHook(event, scriptPath, agentName, opts)
}
```

### lib/components/skills.js

```js
async function installSkill(skillDef, fetchFile, agentAdapter, opts) {
  // 1. Fetch SKILL.md from skillDef.path via fetchFile
  // 2. Optionally fetch additional files (REFERENCE.md etc.) if they exist
  // 3. Call agentAdapter.installSkill(name, files, opts)
}

async function removeSkill(name, agentAdapter) {
  agentAdapter.removeSkill(name);
}
```

### lib/components/mcp.js

```js
async function installMcp(mcpDef, agentAdapter, pluginName, opts) {
  // 1. Build config from mcpDef:
  //    type=url → { type: "url", url: mcpDef.url, __proctl: pluginName }
  //    type=stdio → { type: "stdio", command: mcpDef.command, args: mcpDef.args,
  //                   env: mcpDef.env, __proctl: pluginName }
  // 2. Replace {{pluginDir}} in command strings with actual plugin runtime dir
  // 3. Call agentAdapter.installMcp(name, config, opts)
}
```

### lib/components/hooks.js

```js
async function installHook(hookDef, fetchFile, agentAdapter, pluginName, pluginDir, opts) {
  // Platform note: hook scripts on Windows are .ps1 files
  // 1. Copy script to pluginDir/hooks/<script-filename>
  //    - Use fs.copyFile for local source
  //    - Use fetchFile + fs.writeFile for remote
  // 2. Build hook config:
  //    {
  //      hooks: [{
  //        type: "command",
  //        command: `powershell -File "${destPath}"`,   // Windows: powershell
  //        async: hookDef.async ?? true,
  //        __proctl: pluginName
  //      }]
  //    }
  //    For PreToolUse/PostToolUse: also include matcher (default: "*")
  // 3. Call agentAdapter.installHook(hookDef.event, hookGroupConfig, opts)
}
```

### lib/components/commands.js

```js
async function installCommand(cmdDef, fetchFile, agentAdapter, pluginName, opts) {
  // 1. Fetch .md file from cmdDef.path
  // 2. Call agentAdapter.installCommand(name, content, opts)
}
```

### lib/components/statusline.js

```js
async function installStatusline(config, agentAdapter, pluginName, pluginDir, opts) {
  // 1. Build statusline config:
  //    {
  //      type: "command",
  //      command: `node "${pluginDir}/bin/${config.script}"`,
  //      refreshInterval: config.refreshInterval || 5,
  //      __proctl: pluginName
  //    }
  // 2. Call agentAdapter.installStatusline(config, opts)
}
```

### lib/settings.js

Safe JSON settings file manager.

```js
class Settings {
  constructor(filePath)

  read() → object                    // parse JSON, return {} if missing or corrupt
  write(obj)                         // atomic: write to .tmp then fs.renameSync
  backup() → backupPath              // copy to <file>.proctl-bak-<ISOtimestamp>
  mergeKey(key, value)               // set top-level key (preserves other keys)
  mergeArrayItem(keyPath, item)      // push to nested array (e.g. hooks.PreToolUse)
  removeArrayItems(keyPath, pred)    // filter array by predicate (for removal)
  removeByTag(pluginName)            // remove all entries where __proctl === pluginName
}
```

Safety rules:
- Always call `backup()` before any write
- Atomic write: write to `.tmp` file, then `fs.renameSync` to final path
- Never delete the entire settings file — always read → modify → write
- If settings.json doesn't exist: create it fresh with `{}`

### lib/state.js

Tracks installed plugins. File: `path.join(os.homedir(), '.claude', 'proctl', 'state.json')`

```js
class StateTracker {
  getAll() → { [pluginName]: PluginState }
  get(pluginName) → PluginState | null
  set(pluginName, state)
  remove(pluginName)
  addComponent(pluginName, type, name)
  removeComponent(pluginName, type, name)
  isInstalled(pluginName) → bool
}

// PluginState shape:
{
  source: "109628/provana-core",
  version: "1.0.0",
  installedAt: "ISO string",
  updatedAt: "ISO string",
  components: {
    skills: ["git-workflow", "api-design"],
    mcp_servers: [],
    hooks: ["dangerous-bash-guard"],
    commands: [],
    statusline: false
  },
  agents: ["claude-code"]
}
```

### lib/ui.js

Interactive prompts.

```js
async function pickPlugin(plugins) → pluginName
async function pickComponents(manifest) → { skills, mcp, hooks, commands, statusline }
  // Checkbox grouped by type, all pre-selected
async function pickAgents(available) → string[]
  // available = ['claude-code', 'copilot'], show detected vs not
async function confirmInstall(summary) → bool
```

## Error handling

Typed errors: `RegistryError`, `ManifestError`, `InstallError`, `AgentError`

Actionable messages: "Could not find plugin.json at 109628/provana-core — ensure
the repo exists and has a plugin.json at root"

CLI layer catches and prints cleanly. Stack traces only with `--verbose`.

## File system layout after install

```
%USERPROFILE%\.claude\
├── settings.json                 # MCP + hooks entries with __proctl tags
├── skills\
│   ├── git-workflow\SKILL.md     # installed by proctl
│   └── api-design\SKILL.md      # installed by proctl
├── commands\
│   └── provana-help.md
└── proctl\
    ├── state.json                # tracker
    ├── registries.json           # named registries
    └── plugins\
        └── provana-core\
            └── hooks\
                └── dangerous-bash-guard.ps1
```
