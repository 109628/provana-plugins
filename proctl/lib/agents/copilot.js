'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const Settings = require('../settings');

function skillsDir() {
  return path.join(process.cwd(), '.github', 'copilot', 'skills');
}

function mcpSettingsPath() {
  return path.join(process.cwd(), '.vscode', 'mcp.json');
}

const copilot = {
  name: 'copilot',

  detect() {
    const instructionsFile = path.join(process.cwd(), '.github', 'copilot-instructions.md');
    const configDir = path.join(os.homedir(), '.config', 'github-copilot');
    return fs.existsSync(instructionsFile) || fs.existsSync(configDir);
  },

  capabilities() {
    return { skills: true, mcp: true, hooks: false, commands: false, statusline: false };
  },

  getSettingsPath() {
    return mcpSettingsPath();
  },

  getSkillsDir() {
    return skillsDir();
  },

  installSkill(name, files, opts = {}) {
    const dest = path.join(skillsDir(), name);
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
    if (opts.verbose) console.log(`  [copilot] skill "${name}" → ${dest}`);
  },

  installMcp(name, config, opts = {}) {
    const sp = mcpSettingsPath();
    const settings = new Settings(sp);
    if (!opts.dryRun) {
      settings.backup();
      const obj = settings.read();
      if (!obj.servers) obj.servers = {};
      // Translate Claude Code format to Copilot format
      const copilotConfig = { ...config };
      if (copilotConfig.type === 'url') copilotConfig.type = 'sse';
      obj.servers[name] = copilotConfig;
      settings.write(obj);
    }
    if (opts.verbose) console.log(`  [copilot] MCP "${name}" added to .vscode/mcp.json`);
  },

  installHook() {
    console.warn('\x1b[33m  Warning: GitHub Copilot does not support hooks — skipping\x1b[0m');
  },

  installCommand() {
    console.warn('\x1b[33m  Warning: GitHub Copilot does not support commands — skipping\x1b[0m');
  },

  installStatusline() {
    console.warn('\x1b[33m  Warning: GitHub Copilot does not support statusline — skipping\x1b[0m');
  },

  removeSkill(name) {
    const dest = path.join(skillsDir(), name);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  },

  removeMcp(name, pluginName) {
    const sp = mcpSettingsPath();
    if (!fs.existsSync(sp)) return;
    const settings = new Settings(sp);
    settings.backup();
    const obj = settings.read();
    if (obj.servers) {
      for (const key of Object.keys(obj.servers)) {
        if (key === name && obj.servers[key].__proctl === pluginName) {
          delete obj.servers[key];
        }
      }
    }
    settings.write(obj);
  },

  removeHook() {},
  removeCommand() {},
  removeStatusline() {},

  removeByPlugin(pluginName) {
    const sp = mcpSettingsPath();
    if (!fs.existsSync(sp)) return;
    const settings = new Settings(sp);
    settings.backup();
    const obj = settings.read();
    if (obj.servers) {
      for (const key of Object.keys(obj.servers)) {
        if (obj.servers[key].__proctl === pluginName) delete obj.servers[key];
      }
    }
    settings.write(obj);
  }
};

module.exports = copilot;
