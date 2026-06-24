'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CODEX_DIR = path.join(os.homedir(), '.codex');
const CONFIG_PATH = path.join(CODEX_DIR, 'config.toml');

function skillsDir() {
  return path.join(CODEX_DIR, 'skills');
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return '';
    return fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    return '';
  }
}

function writeConfig(content) {
  const tmp = CONFIG_PATH + '.proctl-tmp';
  // Backup before write
  if (fs.existsSync(CONFIG_PATH)) {
    const bak = `${CONFIG_PATH}.proctl-bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(CONFIG_PATH, bak);
  }
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

function buildMcpToml(name, config) {
  const lines = [`[mcp_servers.${name}]`, `# __proctl: ${config.__proctl || name}`];
  if (config.command) lines.push(`command = '${config.command}'`);
  if (config.args && config.args.length) {
    lines.push(`args = [${config.args.map(a => `'${a}'`).join(', ')}]`);
  } else {
    lines.push('args = []');
  }
  if (config.env) {
    lines.push(`[mcp_servers.${name}.env]`);
    for (const [k, v] of Object.entries(config.env)) {
      lines.push(`${k} = '${v}'`);
    }
  }
  return lines.join('\n') + '\n';
}

const codex = {
  name: 'codex',

  detect() {
    return fs.existsSync(CODEX_DIR);
  },

  capabilities() {
    // Codex has no hook or command system — skills + MCP only
    return { skills: true, mcp: true, hooks: false, commands: false, statusline: false };
  },

  getSettingsPath() {
    return CONFIG_PATH;
  },

  getSkillsDir() {
    return skillsDir();
  },

  installSkill(name, files, opts = {}) {
    const dest = path.join(skillsDir(), name);
    if (!opts.dryRun) {
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
    }
    if (opts.verbose) console.log(`  [codex] skill "${name}" → ${dest}`);
  },

  installMcp(name, config, opts = {}) {
    if (opts.dryRun) return;
    let content = readConfig();
    // Remove existing entry with same name (idempotency)
    content = removeMcpBlock(content, name);
    // Append new block
    content = content.trimEnd() + '\n\n' + buildMcpToml(name, config);
    writeConfig(content);
    if (opts.verbose) console.log(`  [codex] MCP "${name}" added to config.toml`);
  },

  removeSkill(name, opts = {}) {
    const dest = path.join(skillsDir(), name);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true });
    }
  },

  removeMcp(name, pluginName, opts = {}) {
    let content = readConfig();
    content = removeMcpBlock(content, name);
    writeConfig(content);
  },

  removeHook() { /* no-op — Codex has no hook system */ },
  removeCommand() { /* no-op */ },
  removeStatusline() { /* no-op */ },
  removeByPlugin(pluginName, opts = {}) {
    // Remove all MCP blocks tagged with this plugin name
    let content = readConfig();
    // Find all [mcp_servers.X] blocks where __proctl comment matches pluginName
    const blockRegex = /\[mcp_servers\.([^\]]+)\]\n# __proctl: ([^\n]+)/g;
    let match;
    const toRemove = [];
    while ((match = blockRegex.exec(content)) !== null) {
      if (match[2].trim() === pluginName) {
        toRemove.push(match[1]);
      }
    }
    for (const name of toRemove) {
      content = removeMcpBlock(content, name);
    }
    if (toRemove.length > 0) writeConfig(content);
  }
};

function removeMcpBlock(content, name) {
  // Remove [mcp_servers.name] block and its sub-table [mcp_servers.name.env]
  // Match from [mcp_servers.name] up to next top-level section or end of file
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `\\[mcp_servers\\.${escaped}(?:\\.env)?\\][^\\[]*`,
    'g'
  );
  return content.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

module.exports = codex;
