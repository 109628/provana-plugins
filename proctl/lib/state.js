'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_PATH = process.env.PROCTL_HOME
  ? path.join(process.env.PROCTL_HOME, 'state.json')
  : path.join(os.homedir(), '.claude', 'proctl', 'state.json');

class StateTracker {
  constructor(statePath) {
    this.statePath = statePath || STATE_PATH;
  }

  _read() {
    try {
      if (!fs.existsSync(this.statePath)) return {};
      return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
    } catch {
      return {};
    }
  }

  _write(data) {
    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = this.statePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.statePath);
  }

  getAll() {
    return this._read();
  }

  get(pluginName) {
    return this._read()[pluginName] || null;
  }

  set(pluginName, state) {
    const data = this._read();
    data[pluginName] = state;
    this._write(data);
  }

  remove(pluginName) {
    const data = this._read();
    delete data[pluginName];
    this._write(data);
  }

  addComponent(pluginName, type, name) {
    const data = this._read();
    if (!data[pluginName]) return;
    if (!data[pluginName].components[type]) data[pluginName].components[type] = [];
    if (!data[pluginName].components[type].includes(name)) {
      data[pluginName].components[type].push(name);
    }
    this._write(data);
  }

  removeComponent(pluginName, type, name) {
    const data = this._read();
    if (!data[pluginName]) return;
    if (!data[pluginName].components[type]) return;
    data[pluginName].components[type] = data[pluginName].components[type].filter(n => n !== name);
    this._write(data);
  }

  isInstalled(pluginName) {
    return !!this._read()[pluginName];
  }
}

module.exports = StateTracker;
