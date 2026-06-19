'use strict';

const fs = require('fs');
const path = require('path');

class Settings {
  constructor(filePath) {
    this.filePath = filePath;
  }

  read() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  write(obj) {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  backup() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.filePath}.proctl-bak-${ts}`;
    if (fs.existsSync(this.filePath)) {
      fs.copyFileSync(this.filePath, backupPath);
    }
    return backupPath;
  }

  mergeKey(key, value) {
    const obj = this.read();
    obj[key] = value;
    this.write(obj);
  }

  mergeArrayItem(keyPath, item) {
    const obj = this.read();
    const parts = keyPath.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (!Array.isArray(cur[last])) cur[last] = [];
    cur[last].push(item);
    this.write(obj);
  }

  removeArrayItems(keyPath, pred) {
    const obj = this.read();
    const parts = keyPath.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) return;
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(cur[last])) {
      cur[last] = cur[last].filter(item => !pred(item));
    }
    this.write(obj);
  }

  removeByTag(pluginName) {
    const obj = this.read();

    // Remove from mcpServers
    if (obj.mcpServers) {
      for (const key of Object.keys(obj.mcpServers)) {
        if (obj.mcpServers[key].__proctl === pluginName) {
          delete obj.mcpServers[key];
        }
      }
    }

    // Remove from hooks event arrays
    if (obj.hooks) {
      for (const event of Object.keys(obj.hooks)) {
        if (Array.isArray(obj.hooks[event])) {
          obj.hooks[event] = obj.hooks[event].filter(g => g.__proctl !== pluginName);
        }
        if (obj.hooks[event].length === 0) delete obj.hooks[event];
      }
      if (Object.keys(obj.hooks).length === 0) delete obj.hooks;
    }

    // Remove statusLine
    if (obj.statusLine && obj.statusLine.__proctl === pluginName) {
      delete obj.statusLine;
    }

    this.write(obj);
  }
}

module.exports = Settings;
