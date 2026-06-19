'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const Settings = require('../settings');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

function settingsPath(scope) {
  if (scope === 'project') return path.join(process.cwd(), '.claude', 'settings.json');
  return path.join(CLAUDE_DIR, 'settings.json');
}

function skillsDir(scope) {
  if (scope === 'project') return path.join(process.cwd(), '.claude', 'skills');
  return path.join(CLAUDE_DIR, 'skills');
}

function commandsDir(scope) {
  if (scope === 'project') return path.join(process.cwd(), '.claude', 'commands');
  return path.join(CLAUDE_DIR, 'commands');
}

const claudeCode = {
  name: 'claude-code',

  detect() {
    return fs.existsSync(CLAUDE_DIR);
  },

  capabilities() {
    return { skills: true, mcp: true, hooks: true, commands: true, statusline: true };
  },

  getSettingsPath(scope) {
    return settingsPath(scope || 'global');
  },

  getSkillsDir(scope) {
    return skillsDir(scope || 'global');
  },

  installSkill(name, files, opts = {}) {
    const scope = opts.global === false ? 'project' : 'global';
    const dest = path.join(skillsDir(scope), name);
    fs.mkdirSync(dest, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(dest, filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (Buffer.isBuffer(content)) {
        fs.writeFileSync(filePath, content);
      } else {
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
    if (opts.verbose) console.log(`  [claude-code] skill "${name}" → ${dest}`);
  },

  installMcp(name, config, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    if (!opts.dryRun) {
      settings.backup();
      const obj = settings.read();
      if (!obj.mcpServers) obj.mcpServers = {};
      obj.mcpServers[name] = config;
      settings.write(obj);
    }
    if (opts.verbose) console.log(`  [claude-code] MCP "${name}" added to settings`);
  },

  installHook(event, hookGroupConfig, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    if (!opts.dryRun) {
      settings.backup();
      const obj = settings.read();
      if (!obj.hooks) obj.hooks = {};
      if (!obj.hooks[event]) obj.hooks[event] = [];
      // Remove existing entry with same __proctl tag (idempotency)
      obj.hooks[event] = obj.hooks[event].filter(g => g.__proctl !== hookGroupConfig.__proctl);
      obj.hooks[event].push(hookGroupConfig);
      settings.write(obj);
    }
    if (opts.verbose) console.log(`  [claude-code] hook "${event}" added to settings`);
  },

  installCommand(name, content, opts = {}) {
    const scope = opts.global === false ? 'project' : 'global';
    const dest = path.join(commandsDir(scope), `${name}.md`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!opts.dryRun) {
      if (Buffer.isBuffer(content)) {
        fs.writeFileSync(dest, content);
      } else {
        fs.writeFileSync(dest, content, 'utf8');
      }
    }
    if (opts.verbose) console.log(`  [claude-code] command "${name}" → ${dest}`);
  },

  installStatusline(config, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    if (!opts.dryRun) {
      settings.backup();
      const obj = settings.read();
      if (obj.statusLine && !obj.statusLine.__proctl) {
        console.warn('\x1b[33m  Warning: existing statusLine has no __proctl tag — overwriting\x1b[0m');
      }
      obj.statusLine = config;
      settings.write(obj);
    }
    if (opts.verbose) console.log(`  [claude-code] statusLine set`);
  },

  removeSkill(name, opts = {}) {
    const scope = opts.global === false ? 'project' : 'global';
    const dest = path.join(skillsDir(scope), name);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true });
    }
  },

  removeMcp(name, pluginName, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    settings.backup();
    const obj = settings.read();
    if (obj.mcpServers) {
      for (const key of Object.keys(obj.mcpServers)) {
        if (key === name && obj.mcpServers[key].__proctl === pluginName) {
          delete obj.mcpServers[key];
        }
      }
    }
    settings.write(obj);
  },

  removeHook(pluginName, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    settings.backup();
    const obj = settings.read();
    if (obj.hooks) {
      for (const event of Object.keys(obj.hooks)) {
        if (Array.isArray(obj.hooks[event])) {
          obj.hooks[event] = obj.hooks[event].filter(g => g.__proctl !== pluginName);
          if (obj.hooks[event].length === 0) delete obj.hooks[event];
        }
      }
      if (Object.keys(obj.hooks).length === 0) delete obj.hooks;
    }
    settings.write(obj);
  },

  removeCommand(name, opts = {}) {
    const scope = opts.global === false ? 'project' : 'global';
    const dest = path.join(commandsDir(scope), `${name}.md`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  },

  removeStatusline(pluginName, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    settings.backup();
    const obj = settings.read();
    if (obj.statusLine && obj.statusLine.__proctl === pluginName) {
      delete obj.statusLine;
      settings.write(obj);
    }
  },

  removeByPlugin(pluginName, opts = {}) {
    const sp = settingsPath(opts.global === false ? 'project' : 'global');
    const settings = new Settings(sp);
    settings.backup();
    settings.removeByTag(pluginName);
  }
};

module.exports = claudeCode;
