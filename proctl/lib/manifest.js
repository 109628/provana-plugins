'use strict';

const VALID_HOOK_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit',
  'Stop', 'SubagentStop', 'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact'
]);

const VALID_AGENTS = new Set(['claude-code', 'copilot', 'codex']);

class ManifestError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ManifestError';
    this.errors = errors || [];
  }
}

class Manifest {
  constructor(raw) {
    const { valid, errors } = Manifest.validate(raw);
    if (!valid) throw new ManifestError('Invalid plugin.json', errors);
    this._raw = raw;
  }

  get name() { return this._raw.name; }
  get version() { return this._raw.version; }
  get description() { return this._raw.description; }
  get author() { return this._raw.author; }
  get components() { return this._raw.components || {}; }
  get agents() { return this._raw.agents || {}; }
  get files() { return this._raw.files || []; }

  filter({ skills, mcp, hooks, commands, statusline, onlyTypes } = {}) {
    const raw = JSON.parse(JSON.stringify(this._raw));
    const comps = raw.components || {};

    if (onlyTypes) {
      const allowed = new Set(onlyTypes);
      for (const key of Object.keys(comps)) {
        const normalized = key === 'mcp_servers' ? 'mcp' : key;
        if (!allowed.has(normalized) && !allowed.has(key)) delete comps[key];
      }
    }

    if (skills && comps.skills) {
      const keep = new Set(skills);
      for (const k of Object.keys(comps.skills)) {
        if (!keep.has(k)) delete comps.skills[k];
      }
    }

    if (mcp && comps.mcp_servers) {
      const keep = new Set(mcp);
      for (const k of Object.keys(comps.mcp_servers)) {
        if (!keep.has(k)) delete comps.mcp_servers[k];
      }
    }

    if (hooks && comps.hooks) {
      const keep = new Set(hooks);
      for (const k of Object.keys(comps.hooks)) {
        if (!keep.has(k)) delete comps.hooks[k];
      }
    }

    if (commands && comps.commands) {
      const keep = new Set(commands);
      for (const k of Object.keys(comps.commands)) {
        if (!keep.has(k)) delete comps.commands[k];
      }
    }

    if (statusline === false) {
      delete comps.statusline;
    }

    raw.components = comps;
    return new Manifest(raw);
  }

  listSkills() {
    const skills = this.components.skills || {};
    return Object.entries(skills).map(([name, def]) => ({ name, description: def.description }));
  }

  listMcpServers() {
    const servers = this.components.mcp_servers || {};
    return Object.entries(servers).map(([name, def]) => ({ name, description: def.description }));
  }

  listHooks() {
    const hooks = this.components.hooks || {};
    return Object.entries(hooks).map(([name, def]) => ({ name, event: def.event, description: def.description }));
  }

  listCommands() {
    const commands = this.components.commands || {};
    return Object.entries(commands).map(([name]) => ({ name }));
  }

  hasStatusline() {
    return !!this.components.statusline;
  }

  supportsAgent(agentName) {
    const agentConf = this.agents[agentName];
    if (agentConf === undefined) return true; // default: supported
    return agentConf.supported !== false;
  }

  agentCapabilities(agentName) {
    const comps = this.components;
    const agentConf = this.agents[agentName] || {};
    if (agentName === 'copilot' || agentConf.skills_only) {
      return { skills: !!comps.skills, mcp: !!comps.mcp_servers, hooks: false, commands: false, statusline: false };
    }
    return {
      skills: !!comps.skills,
      mcp: !!comps.mcp_servers,
      hooks: !!comps.hooks,
      commands: !!comps.commands,
      statusline: !!comps.statusline
    };
  }

  static validate(raw) {
    const errors = [];

    if (!raw.name) {
      errors.push('name is required');
    } else if (!/^[a-z][a-z0-9-]*$/.test(raw.name) || raw.name.length > 64) {
      errors.push('name must match /^[a-z][a-z0-9-]*$/ and be max 64 chars');
    }

    if (!raw.version) {
      errors.push('version is required');
    } else if (!/^\d+\.\d+\.\d+/.test(raw.version)) {
      errors.push('version must be a valid semver string');
    }

    if (!raw.description) {
      errors.push('description is required');
    } else if (raw.description.length > 256) {
      errors.push('description must be max 256 chars');
    }

    if (!raw.components || Object.keys(raw.components).length === 0) {
      errors.push('at least one component type must exist in components');
    }

    const comps = raw.components || {};

    for (const [name, def] of Object.entries(comps.skills || {})) {
      if (!def.path) errors.push(`skill "${name}": path is required`);
    }

    for (const [name, def] of Object.entries(comps.mcp_servers || {})) {
      if (!def.type) errors.push(`mcp_server "${name}": type is required`);
      else if (def.type === 'url' && !def.url) errors.push(`mcp_server "${name}": url is required when type=url`);
      else if (def.type === 'stdio' && !def.command) errors.push(`mcp_server "${name}": command is required when type=stdio`);
    }

    for (const [name, def] of Object.entries(comps.hooks || {})) {
      if (!def.event) errors.push(`hook "${name}": event is required`);
      else if (!VALID_HOOK_EVENTS.has(def.event)) errors.push(`hook "${name}": unknown event "${def.event}"`);
      if (!def.script) errors.push(`hook "${name}": script is required`);
    }

    for (const [name, def] of Object.entries(comps.commands || {})) {
      if (!def.path) errors.push(`command "${name}": path is required`);
    }

    for (const agentKey of Object.keys(raw.agents || {})) {
      if (!VALID_AGENTS.has(agentKey)) errors.push(`agents: unknown agent "${agentKey}"`);
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = { Manifest, ManifestError };
