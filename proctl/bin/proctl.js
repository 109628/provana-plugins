#!/usr/bin/env node
'use strict';

const { Command, Option } = require('commander');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { Registry } = require('../lib/registry');
const { Installer } = require('../lib/installer');
const StateTracker = require('../lib/state');
const { Manifest, ManifestError } = require('../lib/manifest');
const { getAdapter, allAdapters, normalize } = require('../lib/agents/index');

const pkg = require('../package.json');

const program = new Command();

program
  .name('proctl')
  .description('Provana plugin manager for AI coding agents')
  .version(pkg.version)
  .option('-v, --verbose', 'print debug output')
  .option('--dry-run', 'show what would happen, don\'t write files')
  .option('-y, --yes', 'skip all confirmation prompts');

function makeContext(cmd) {
  const globals = program.opts();
  const opts = { ...globals, ...cmd.opts() };
  const proctlHome = process.env.PROCTL_HOME ||
    path.join(os.homedir(), '.claude', 'proctl');
  const registry = new Registry(path.join(proctlHome, 'registries.json'));
  const state = new StateTracker(path.join(proctlHome, 'state.json'));
  const installer = new Installer(registry, state);
  return { opts, registry, state, installer };
}

function handleError(e, verbose) {
  if (verbose || program.opts().verbose) {
    console.error(e);
  } else {
    console.error(`\x1b[31mError:\x1b[0m ${e.message}`);
  }
  const code = e.code || 1;
  process.exit(typeof code === 'number' ? code : 1);
}

// ── proctl add ────────────────────────────────────────────────────────────────
const addCmd = program
  .command('add <source>')
  .description('Install a plugin or specific components')
  .option('-p, --plugin <name>', 'install specific plugin (for multi-plugin repos)')
  .option('-s, --skill <name>', 'install only this skill (repeatable)', (v, prev) => prev.concat(v), [])
  .option('-m, --mcp <name>', 'install only this MCP server (repeatable)', (v, prev) => prev.concat(v), [])
  .option('--hook <name>', 'install only this hook (repeatable)', (v, prev) => prev.concat(v), [])
  .option('--command <name>', 'install only this command (repeatable)', (v, prev) => prev.concat(v), [])
  .option('--statusline', 'install only the statusline')
  .option('--only <types>', 'comma-separated component types: skills,mcp,hooks')
  .option('--all', 'install all components')
  .option('-a, --agent <name>', 'target agent (repeatable: claude, copilot)', (v, prev) => prev.concat(normalize(v)), [])
  .option('-g, --global', 'install to global scope (Claude Code only)')
  .action(async (source, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const registry = new Registry(path.join(proctlHome, 'registries.json'));
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(registry, state);

    try {
      console.log(`\n  Fetching plugin from ${source}...`);

      await installer.install(source, {
        plugin: opts.plugin,
        skills: opts.skill && opts.skill.length ? opts.skill : undefined,
        mcp: opts.mcp && opts.mcp.length ? opts.mcp : undefined,
        hooks: opts.hook && opts.hook.length ? opts.hook : undefined,
        commands: opts.command && opts.command.length ? opts.command : undefined,
        statusline: opts.statusline,
        onlyTypes: opts.only,
        all: opts.all,
        agents: opts.agent && opts.agent.length ? opts.agent : undefined,
        global: opts.global !== false,
        yes: opts.yes,
        dryRun: opts.dryRun,
        verbose: opts.verbose
      });
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

// ── proctl remove ─────────────────────────────────────────────────────────────
program
  .command('remove <plugin>')
  .description('Remove an installed plugin or specific components')
  .option('-s, --skill <name>', 'remove only this skill (repeatable)', (v, prev) => prev.concat(v), [])
  .option('-m, --mcp <name>', 'remove only this MCP server', (v, prev) => prev.concat(v), [])
  .option('--hook <name>', 'remove only this hook', (v, prev) => prev.concat(v), [])
  .option('--command <name>', 'remove only this command', (v, prev) => prev.concat(v), [])
  .option('--statusline', 'remove only the statusline')
  .option('-a, --agent <name>', 'remove from specific agent only', (v, prev) => prev.concat(normalize(v)), [])
  .option('--all', 'remove all components without prompt')
  .action(async (pluginName, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(null, state);

    try {
      await installer.remove(pluginName, {
        skill: opts.skill && opts.skill.length ? opts.skill : undefined,
        mcp: opts.mcp && opts.mcp.length ? opts.mcp : undefined,
        hook: opts.hook && opts.hook.length ? opts.hook : undefined,
        command: opts.command && opts.command.length ? opts.command : undefined,
        statusline: opts.statusline,
        agent: opts.agent && opts.agent.length ? opts.agent : undefined,
        yes: opts.yes,
        dryRun: opts.dryRun,
        verbose: opts.verbose
      });
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

// ── proctl list ───────────────────────────────────────────────────────────────
program
  .command('list')
  .description('Show installed plugins and components')
  .option('--available <source>', 'list plugins available at a remote source')
  .option('--json', 'output as JSON')
  .option('--components', 'show component details per plugin')
  .action(async (options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const all = state.getAll();

    if (opts.available) {
      const registry = new Registry(path.join(proctlHome, 'registries.json'));
      try {
        const plugins = await registry.listPlugins(opts.available);
        if (opts.json) {
          console.log(JSON.stringify(plugins, null, 2));
        } else {
          console.log('\n  Available plugins:\n');
          for (const p of plugins) {
            console.log(`  ${p.name} v${p.version} — ${p.description}`);
          }
        }
      } catch (e) {
        handleError(e, opts.verbose);
      }
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(all, null, 2));
      return;
    }

    const entries = Object.entries(all);
    if (entries.length === 0) {
      console.log('  No plugins installed. Run: proctl add <source>');
      return;
    }

    console.log('\n  Installed plugins:\n');
    for (const [name, info] of entries) {
      if (name.startsWith('__standalone__')) continue;
      console.log(`  \x1b[1m${name} v${info.version}\x1b[0m  (from ${info.source})`);
      for (const agent of (info.agents || [])) {
        const comps = info.components || {};
        const parts = [];
        if (comps.skills && comps.skills.length) parts.push(`skills(${comps.skills.length})`);
        if (comps.mcp_servers && comps.mcp_servers.length) parts.push(`mcp(${comps.mcp_servers.length})`);
        if (comps.hooks && comps.hooks.length) parts.push(`hooks(${comps.hooks.length})`);
        if (comps.commands && comps.commands.length) parts.push(`commands(${comps.commands.length})`);
        if (comps.statusline) parts.push('statusline');
        console.log(`    ${agent.padEnd(14)} ${parts.join(' ')}`);
      }
      if (opts.components) {
        const comps = info.components || {};
        if (comps.skills && comps.skills.length) console.log(`      Skills: ${comps.skills.join(', ')}`);
        if (comps.mcp_servers && comps.mcp_servers.length) console.log(`      MCP: ${comps.mcp_servers.join(', ')}`);
        if (comps.hooks && comps.hooks.length) console.log(`      Hooks: ${comps.hooks.join(', ')}`);
        if (comps.commands && comps.commands.length) console.log(`      Commands: ${comps.commands.join(', ')}`);
      }
    }

    // Show standalones
    const standalones = entries.filter(([k]) => k.startsWith('__standalone__'));
    if (standalones.length > 0) {
      console.log('\n  Standalone installs:\n');
      for (const [key, info] of standalones) {
        const label = key.replace(/^__standalone__/, '').replace(/__/, '/');
        console.log(`  ${label}  (from ${info.source})`);
      }
    }
    console.log();
  });

// ── proctl update ─────────────────────────────────────────────────────────────
program
  .command('update <plugin>')
  .description('Fetch latest version and reinstall a plugin')
  .option('--check', 'check for updates without installing')
  .action(async (pluginName, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const registry = new Registry(path.join(proctlHome, 'registries.json'));
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(registry, state);

    try {
      await installer.update(pluginName, { check: opts.check, dryRun: opts.dryRun, verbose: opts.verbose });
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

// ── proctl init ───────────────────────────────────────────────────────────────
program
  .command('init <name>')
  .description('Scaffold a new plugin repository')
  .option('--from-claude', 'auto-populate from existing ~/.claude/ directory')
  .action(async (name, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };
    const dest = path.join(process.cwd(), name);

    if (fs.existsSync(dest)) {
      console.error(`\x1b[31mError:\x1b[0m Directory "${name}" already exists`);
      process.exit(1);
    }

    fs.mkdirSync(dest, { recursive: true });
    fs.mkdirSync(path.join(dest, 'skills', 'example-skill'), { recursive: true });
    fs.mkdirSync(path.join(dest, 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(dest, 'commands'), { recursive: true });

    const pluginJson = {
      name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '0.1.0',
      description: `${name} plugin for AI coding agents`,
      author: '',
      components: {
        skills: {
          'example-skill': {
            path: 'skills/example-skill',
            description: 'Example skill — replace with your own'
          }
        }
      },
      agents: {
        'claude-code': { supported: true },
        copilot: { supported: true, skills_only: true }
      }
    };

    fs.writeFileSync(path.join(dest, 'plugin.json'), JSON.stringify(pluginJson, null, 2), 'utf8');

    const skillMd = `---
name: example-skill
description: Example skill — replace with your own description
---

# Example Skill

Describe what this skill does and when the agent should use it.

## Usage

Add your skill instructions here.
`;
    fs.writeFileSync(path.join(dest, 'skills', 'example-skill', 'SKILL.md'), skillMd, 'utf8');

    const readmeMd = `# ${name}

A proctl plugin for AI coding agents.

## Install

\`\`\`bash
proctl add ./${name}
\`\`\`

## Components

- Skills: example-skill

## Development

Edit \`plugin.json\` to add more components.
Run \`proctl add ./${name} --all -a claude -y\` to test locally.
`;
    fs.writeFileSync(path.join(dest, 'README.md'), readmeMd, 'utf8');

    const conversationMd = `# ${name} — Decisions Log

Use this file to record architectural decisions as you build the plugin.
`;
    fs.writeFileSync(path.join(dest, 'conversation.md'), conversationMd, 'utf8');

    console.log(`\n  \x1b[32m✓\x1b[0m Scaffolded plugin: ${dest}`);
    console.log(`    Edit plugin.json to configure components.`);
    console.log(`    Test with: proctl add ./${name} --all -a claude -y\n`);
  });

// ── proctl skill ──────────────────────────────────────────────────────────────
const skillCmd = program
  .command('skill')
  .description('Manage standalone skills');

skillCmd
  .command('add <source>')
  .description('Install a bare SKILL.md directly (no plugin.json needed)')
  .option('-a, --agent <name>', 'target agent (default: claude)', 'claude')
  .action(async (source, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(null, state);

    try {
      await installer.installStandaloneSkill(source, normalize(opts.agent), opts);
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

skillCmd
  .command('remove <name>')
  .description('Remove a standalone skill')
  .option('-a, --agent <name>', 'target agent (default: claude)', 'claude')
  .action(async (name, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(null, state);

    try {
      await installer.remove(`__standalone__skill__${name}`, { yes: true });
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

// ── proctl mcp ────────────────────────────────────────────────────────────────
const mcpCmd = program
  .command('mcp')
  .description('Manage standalone MCP servers');

mcpCmd
  .command('add <name> <command-or-url>')
  .description('Install a standalone MCP server (no plugin.json needed)')
  .option('--env <KEY=VAL>', 'environment variable (repeatable)', (v, prev) => prev.concat(v), [])
  .option('-a, --agent <name>', 'target agent (default: claude)', 'claude')
  .action(async (name, commandOrUrl, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(null, state);

    try {
      await installer.installStandaloneMcp(name, commandOrUrl, opts.env, normalize(opts.agent), opts);
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

mcpCmd
  .command('remove <name>')
  .description('Remove a standalone MCP server')
  .action(async (name, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(null, state);

    try {
      await installer.remove(`__standalone__mcp__${name}`, { yes: true });
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

// ── proctl hook ───────────────────────────────────────────────────────────────
const hookCmd = program
  .command('hook')
  .description('Manage standalone hooks');

hookCmd
  .command('add <event> <script-path>')
  .description('Install a standalone hook (no plugin.json needed)')
  .option('--matcher <pattern>', 'regex for PreToolUse/PostToolUse (default: *)')
  .option('--async', 'run hook asynchronously')
  .option('-a, --agent <name>', 'target agent (default: claude)', 'claude')
  .action(async (event, scriptPath, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const state = new StateTracker(path.join(proctlHome, 'state.json'));
    const installer = new Installer(null, state);

    try {
      await installer.installStandaloneHook(event, scriptPath, normalize(opts.agent), {
        matcher: opts.matcher,
        async: opts.async,
        dryRun: opts.dryRun,
        verbose: opts.verbose
      });
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

// ── proctl registry ───────────────────────────────────────────────────────────
const registryCmd = program
  .command('registry')
  .description('Manage named registries');

registryCmd
  .command('add <alias> <url>')
  .description('Register a named registry for shorthand source resolution')
  .option('--token <token>', 'GitHub PAT for private repos')
  .action((alias, url, options) => {
    const globals = program.opts();
    const opts = { ...globals, ...options };

    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const registry = new Registry(path.join(proctlHome, 'registries.json'));

    try {
      registry.addRegistry(alias, url, opts.token);
    } catch (e) {
      handleError(e, opts.verbose);
    }
  });

registryCmd
  .command('list')
  .description('List registered registries')
  .action(() => {
    const proctlHome = process.env.PROCTL_HOME ||
      path.join(os.homedir(), '.claude', 'proctl');
    const configPath = path.join(proctlHome, 'registries.json');
    try {
      if (!fs.existsSync(configPath)) {
        console.log('  No registries registered. Run: proctl registry add <alias> <url>');
        return;
      }
      const regs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('\n  Registered registries:\n');
      for (const [alias, info] of Object.entries(regs)) {
        console.log(`  ${alias.padEnd(20)} ${info.url}${info.token ? ' (auth)' : ''}`);
      }
      console.log();
    } catch (e) {
      handleError(e);
    }
  });

program.parseAsync(process.argv).catch(e => handleError(e, program.opts().verbose));
