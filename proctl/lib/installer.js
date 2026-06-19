'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { Manifest, ManifestError } = require('./manifest');
const { getAdapter, allAdapters } = require('./agents/index');
const { installSkill, removeSkill } = require('./components/skills');
const { installMcp, pluginDir } = require('./components/mcp');
const { installHook } = require('./components/hooks');
const { installCommand } = require('./components/commands');
const { installStatusline } = require('./components/statusline');

class InstallError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InstallError';
  }
}

class Installer {
  constructor(registry, stateTracker) {
    this.registry = registry;
    this.state = stateTracker;
  }

  async install(source, options = {}) {
    const {
      plugin: pluginFilter,
      skills: skillFilter,
      mcp: mcpFilter,
      hooks: hookFilter,
      commands: commandFilter,
      onlyTypes,
      all: installAll,
      agents: agentNames,
      global: globalScope,
      yes,
      dryRun,
      verbose,
      ui
    } = options;

    // 1. Resolve source — pass plugin name for monorepo subfolder lookup
    const { manifest: rawManifest, fetchFile } = await this.registry.resolve(source, { plugin: pluginFilter });

    // 2. Parse manifest
    let manifest;
    try {
      manifest = new Manifest(rawManifest);
    } catch (e) {
      if (e instanceof ManifestError) {
        throw new InstallError(`Invalid plugin.json:\n  ${e.errors.join('\n  ')}`);
      }
      throw e;
    }

    // 3. Filter components
    let filtered = manifest;
    if (onlyTypes) {
      filtered = filtered.filter({ onlyTypes: onlyTypes.split(',').map(s => s.trim()) });
    }
    if (!installAll) {
      const filterOpts = {};
      if (skillFilter) filterOpts.skills = Array.isArray(skillFilter) ? skillFilter : [skillFilter];
      if (mcpFilter) filterOpts.mcp = Array.isArray(mcpFilter) ? mcpFilter : [mcpFilter];
      if (hookFilter) filterOpts.hooks = Array.isArray(hookFilter) ? hookFilter : [hookFilter];
      if (commandFilter) filterOpts.commands = Array.isArray(commandFilter) ? commandFilter : [commandFilter];
      if (Object.keys(filterOpts).length > 0) filtered = filtered.filter(filterOpts);
    }

    // 4. Determine target agents
    let targetAgents = agentNames
      ? (Array.isArray(agentNames) ? agentNames : [agentNames])
      : null;

    if (!targetAgents) {
      const detected = allAdapters().filter(a => a.detect()).map(a => a.name);
      if (detected.length === 0) {
        console.warn('\x1b[33mNo agents detected. Defaulting to claude-code.\x1b[0m');
        targetAgents = ['claude-code'];
      } else if (detected.length === 1 || yes) {
        targetAgents = detected;
      } else if (ui) {
        targetAgents = await ui.pickAgents(detected);
      } else {
        targetAgents = detected;
      }
    }

    // Show summary
    console.log(`\n  \x1b[1m${manifest.name} v${manifest.version}\x1b[0m — ${manifest.description}\n`);

    const opts = { global: globalScope !== false, dryRun, verbose };
    const installed = { skills: [], mcp_servers: [], hooks: [], commands: [], statusline: false };

    for (const agentName of targetAgents) {
      let adapter;
      try {
        adapter = getAdapter(agentName);
      } catch (e) {
        console.warn(`\x1b[33m  Warning: ${e.message} — skipping\x1b[0m`);
        continue;
      }

      const caps = adapter.capabilities();
      const comps = filtered.components;

      // Skills
      if (comps.skills && caps.skills) {
        for (const [name, def] of Object.entries(comps.skills)) {
          try {
            await installSkill({ ...def, name }, fetchFile, adapter, opts);
            if (!installed.skills.includes(name)) installed.skills.push(name);
            console.log(`  \x1b[32m✓\x1b[0m skill "${name}" → ${agentName}`);
          } catch (e) {
            console.error(`  \x1b[31m✗\x1b[0m skill "${name}" failed: ${e.message}`);
          }
        }
      } else if (comps.skills && !caps.skills) {
        console.warn(`\x1b[33m  Warning: ${agentName} does not support skills — skipping\x1b[0m`);
      }

      // MCP
      if (comps.mcp_servers && caps.mcp) {
        for (const [name, def] of Object.entries(comps.mcp_servers)) {
          try {
            await installMcp({ ...def, name }, adapter, manifest.name, opts);
            if (!installed.mcp_servers.includes(name)) installed.mcp_servers.push(name);
            console.log(`  \x1b[32m✓\x1b[0m MCP "${name}" → ${agentName}`);
          } catch (e) {
            console.error(`  \x1b[31m✗\x1b[0m MCP "${name}" failed: ${e.message}`);
          }
        }
      } else if (comps.mcp_servers && !caps.mcp) {
        console.warn(`\x1b[33m  Warning: ${agentName} does not support MCP servers — skipping\x1b[0m`);
      }

      // Hooks
      if (comps.hooks) {
        if (!caps.hooks) {
          console.warn(`\x1b[33m  Warning: ${agentName} does not support hooks — skipping\x1b[0m`);
        } else {
          const pDir = pluginDir(manifest.name);
          for (const [name, def] of Object.entries(comps.hooks)) {
            try {
              await installHook({ ...def, name }, fetchFile, adapter, manifest.name, pDir, opts);
              if (!installed.hooks.includes(name)) installed.hooks.push(name);
              console.log(`  \x1b[32m✓\x1b[0m hook "${name}" (${def.event}) → ${agentName}`);
            } catch (e) {
              console.error(`  \x1b[31m✗\x1b[0m hook "${name}" failed: ${e.message}`);
            }
          }
        }
      }

      // Commands
      if (comps.commands) {
        if (!caps.commands) {
          console.warn(`\x1b[33m  Warning: ${agentName} does not support commands — skipping\x1b[0m`);
        } else {
          for (const [name, def] of Object.entries(comps.commands)) {
            try {
              await installCommand({ ...def, name }, fetchFile, adapter, manifest.name, opts);
              if (!installed.commands.includes(name)) installed.commands.push(name);
              console.log(`  \x1b[32m✓\x1b[0m command "${name}" → ${agentName}`);
            } catch (e) {
              console.error(`  \x1b[31m✗\x1b[0m command "${name}" failed: ${e.message}`);
            }
          }
        }
      }

      // Statusline
      if (comps.statusline) {
        if (!caps.statusline) {
          console.warn(`\x1b[33m  Warning: ${agentName} does not support statusline — skipping\x1b[0m`);
        } else {
          try {
            await installStatusline(comps.statusline, adapter, manifest.name, pluginDir(manifest.name), opts);
            installed.statusline = true;
            console.log(`  \x1b[32m✓\x1b[0m statusline → ${agentName}`);
          } catch (e) {
            console.error(`  \x1b[31m✗\x1b[0m statusline failed: ${e.message}`);
          }
        }
      }
    }

    // Update state
    if (!dryRun) {
      const existing = this.state.get(manifest.name) || {};
      const now = new Date().toISOString();
      this.state.set(manifest.name, {
        source,
        plugin: pluginFilter || null,
        version: manifest.version,
        installedAt: existing.installedAt || now,
        updatedAt: now,
        components: {
          skills: installed.skills,
          mcp_servers: installed.mcp_servers,
          hooks: installed.hooks,
          commands: installed.commands,
          statusline: installed.statusline
        },
        agents: targetAgents.map(a => a === 'claude' ? 'claude-code' : a)
      });
    }

    console.log(`\n  \x1b[32m✓ Installed ${manifest.name} v${manifest.version}\x1b[0m`);
    if (!dryRun) {
      const settingsPath = (() => {
        try { return getAdapter(targetAgents[0]).getSettingsPath(); } catch { return null; }
      })();
      if (settingsPath) {
        console.log(`    Settings backed up: ${settingsPath}.proctl-bak-*`);
      }
    }
    if (installed.hooks.length > 0 || installed.mcp_servers.length > 0) {
      console.log('    Restart Claude Code to activate hooks and MCP servers.');
    }
  }

  async remove(pluginName, options = {}) {
    const { skill: skillFilter, mcp: mcpFilter, hook: hookFilter, command: commandFilter,
            statusline: statuslineFlag, all: removeAll, agent: agentFilter, yes, dryRun, verbose } = options;

    const pluginState = this.state.get(pluginName);
    if (!pluginState) {
      throw new InstallError(`Plugin "${pluginName}" is not installed`);
    }

    const agentNames = agentFilter
      ? (Array.isArray(agentFilter) ? agentFilter : [agentFilter])
      : pluginState.agents;

    const opts = { global: true, dryRun, verbose };

    for (const agentName of agentNames) {
      let adapter;
      try { adapter = getAdapter(agentName); } catch { continue; }

      const comps = pluginState.components;

      // Remove skills
      const skillsToRemove = skillFilter
        ? (Array.isArray(skillFilter) ? skillFilter : [skillFilter])
        : comps.skills || [];
      for (const name of skillsToRemove) {
        adapter.removeSkill(name, opts);
        console.log(`  \x1b[32m✓\x1b[0m removed skill "${name}" from ${agentName}`);
      }

      // Remove MCP
      const mcpToRemove = mcpFilter
        ? (Array.isArray(mcpFilter) ? mcpFilter : [mcpFilter])
        : comps.mcp_servers || [];
      if (mcpToRemove.length > 0) {
        for (const name of mcpToRemove) {
          adapter.removeMcp(name, pluginName, opts);
        }
        adapter.removeByPlugin && adapter.removeByPlugin(pluginName, opts);
        console.log(`  \x1b[32m✓\x1b[0m removed MCP servers from ${agentName}`);
      }

      // Remove hooks
      if (!hookFilter && !skillFilter && !mcpFilter && !commandFilter) {
        adapter.removeHook(pluginName, opts);
        if (comps.hooks && comps.hooks.length > 0) {
          console.log(`  \x1b[32m✓\x1b[0m removed hooks from ${agentName}`);
        }
      }

      // Remove commands
      const commandsToRemove = commandFilter
        ? (Array.isArray(commandFilter) ? commandFilter : [commandFilter])
        : comps.commands || [];
      for (const name of commandsToRemove) {
        adapter.removeCommand(name, opts);
        console.log(`  \x1b[32m✓\x1b[0m removed command "${name}" from ${agentName}`);
      }

      // Remove statusline
      if ((!skillFilter && !mcpFilter && !hookFilter && !commandFilter) || statuslineFlag) {
        adapter.removeStatusline(pluginName, opts);
      }
    }

    // Update state
    if (!dryRun) {
      const partialRemove = skillFilter || mcpFilter || hookFilter || commandFilter || statuslineFlag;
      if (partialRemove) {
        // Update components list
        const updatedState = this.state.get(pluginName);
        if (skillFilter) {
          const toRemove = new Set(Array.isArray(skillFilter) ? skillFilter : [skillFilter]);
          updatedState.components.skills = updatedState.components.skills.filter(s => !toRemove.has(s));
        }
        this.state.set(pluginName, updatedState);
      } else {
        this.state.remove(pluginName);
      }
    }

    console.log(`\n  \x1b[32m✓ Removed ${pluginName}\x1b[0m`);
  }

  async update(pluginName, options = {}) {
    const pluginState = this.state.get(pluginName);
    if (!pluginState) throw new InstallError(`Plugin "${pluginName}" is not installed`);

    const { manifest: rawManifest } = await this.registry.resolve(pluginState.source, { plugin: pluginState.plugin });
    const manifest = new Manifest(rawManifest);

    if (manifest.version === pluginState.version && !options.force) {
      console.log(`  ${pluginName} is already up to date (v${manifest.version})`);
      return;
    }

    console.log(`  Updating ${pluginName}: ${pluginState.version} → ${manifest.version}`);

    // Remove old, install new with same config
    await this.remove(pluginName, { yes: true, dryRun: options.dryRun });
    await this.install(pluginState.source, {
      all: true,
      agents: pluginState.agents,
      yes: true,
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  }

  // Standalone installs

  async installStandaloneSkill(source, agentName, opts = {}) {
    const adapter = getAdapter(agentName || 'claude-code');

    let skillName, files;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Fetch raw SKILL.md
      const { Registry } = require('./registry');
      const reg = new Registry();
      const url = new URL(source);
      const pathParts = url.pathname.split('/');
      // Derive skill name from URL
      skillName = pathParts.slice(-2)[0] || 'standalone-skill';
      const res = await require('./registry').Registry.prototype;
      // Simpler: fetch directly
      const https = url.protocol === 'https:' ? require('https') : require('http');
      const content = await new Promise((resolve, reject) => {
        https.get(source, { headers: { 'User-Agent': 'proctl/0.1.0' } }, (res) => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
      });
      files = { 'SKILL.md': content };
    } else {
      // Local path — could be file or dir
      const fs = require('fs');
      const path = require('path');
      const absPath = path.resolve(source);
      if (fs.statSync(absPath).isDirectory()) {
        skillName = path.basename(absPath);
        const skillMdPath = path.join(absPath, 'SKILL.md');
        files = { 'SKILL.md': fs.readFileSync(skillMdPath) };
        const refPath = path.join(absPath, 'REFERENCE.md');
        if (fs.existsSync(refPath)) files['REFERENCE.md'] = fs.readFileSync(refPath);
      } else {
        // File path — use filename stem as skill name (strip extension)
        const base = path.basename(absPath, path.extname(absPath));
        skillName = base === 'SKILL' ? path.basename(path.dirname(absPath)) : base;
        files = { 'SKILL.md': fs.readFileSync(absPath) };
      }
    }

    if (!opts.dryRun) {
      adapter.installSkill(skillName, files, opts);
      this.state.set(`__standalone__skill__${skillName}`, {
        source,
        version: '0.0.0',
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: { skills: [skillName], mcp_servers: [], hooks: [], commands: [], statusline: false },
        agents: [adapter.name]
      });
    }
    console.log(`  \x1b[32m✓\x1b[0m Installed skill "${skillName}" to ${adapter.name}`);
  }

  async installStandaloneMcp(name, commandOrUrl, env, agentName, opts = {}) {
    const adapter = getAdapter(agentName || 'claude-code');
    let config;
    if (commandOrUrl.startsWith('http://') || commandOrUrl.startsWith('https://')) {
      config = { type: 'url', url: commandOrUrl, __proctl: `__standalone__mcp__${name}` };
    } else {
      config = { type: 'stdio', command: commandOrUrl, __proctl: `__standalone__mcp__${name}` };
      if (env && env.length) {
        config.env = {};
        for (const kv of env) {
          const [k, ...rest] = kv.split('=');
          config.env[k] = rest.join('=');
        }
      }
    }
    if (!opts.dryRun) {
      adapter.installMcp(name, config, opts);
      this.state.set(`__standalone__mcp__${name}`, {
        source: commandOrUrl,
        version: '0.0.0',
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: { skills: [], mcp_servers: [name], hooks: [], commands: [], statusline: false },
        agents: [adapter.name]
      });
    }
    console.log(`  \x1b[32m✓\x1b[0m Installed MCP "${name}" to ${adapter.name}`);
  }

  async installStandaloneHook(event, scriptPath, agentName, opts = {}) {
    const adapter = getAdapter(agentName || 'claude-code');
    const fs = require('fs');
    const path = require('path');
    const absScript = path.resolve(scriptPath);
    if (!fs.existsSync(absScript)) throw new InstallError(`Script not found: ${absScript}`);

    const hookName = path.basename(absScript, path.extname(absScript));
    const standalonePluginName = `__standalone__hook__${hookName}`;

    if (!opts.dryRun) {
      await installHook(
        { event, script: absScript, matcher: opts.matcher, name: hookName },
        null, // no fetchFile — local
        adapter,
        standalonePluginName,
        path.dirname(absScript), // use script dir as pluginDir
        opts
      );
      this.state.set(standalonePluginName, {
        source: scriptPath,
        version: '0.0.0',
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: { skills: [], mcp_servers: [], hooks: [hookName], commands: [], statusline: false },
        agents: [adapter.name]
      });
    }
    console.log(`  \x1b[32m✓\x1b[0m Installed hook "${hookName}" (${event}) to ${adapter.name}`);
  }
}

module.exports = { Installer, InstallError };
