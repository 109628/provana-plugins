'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Manifest } = require('./manifest');

class RegistryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RegistryError';
  }
}

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'proctl/0.1.0',
        'Accept': 'application/vnd.github.v3.raw, text/plain, */*'
      }
    };
    if (token) opts.headers['Authorization'] = `token ${token}`;

    mod.get(opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpGet(res.headers.location, token).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

class Registry {
  constructor(registriesConfigPath) {
    this.configPath = registriesConfigPath ||
      path.join(os.homedir(), '.claude', 'proctl', 'registries.json');
    this.token = process.env.PROCTL_GITHUB_TOKEN;
  }

  _readRegistries() {
    try {
      if (!fs.existsSync(this.configPath)) return {};
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  _parseSource(source) {
    if (source.startsWith('./') || source.startsWith('../') || path.isAbsolute(source)) {
      return { type: 'local', path: source };
    }
    if (source.startsWith('https://') || source.startsWith('http://')) {
      const url = new URL(source);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return { type: 'github', owner: parts[0], repo: parts[1] };
      }
      return { type: 'url', url: source };
    }
    const parts = source.split('/');
    if (parts.length === 2) {
      const registries = this._readRegistries();
      if (registries[parts[0]]) {
        return { type: 'alias', alias: parts[0], name: parts[1] };
      }
      return { type: 'github', owner: parts[0], repo: parts[1] };
    }
    // Bare plugin name (e.g. "core") → default Provana registry
    if (parts.length === 1 && /^[a-z][a-z0-9-]*$/.test(source)) {
      return { type: 'github', owner: '109628', repo: 'provana-plugins', impliedPlugin: source };
    }
    throw new RegistryError(`Cannot parse source: "${source}"`);
  }

  async _fetchGitHubRaw(owner, repo, filePath, branch, token) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const result = await httpGet(url, token || this.token);
    return result;
  }

  async _resolveGitHub(owner, repo, token, subfolder) {
    const tok = token || this.token;
    const branches = ['main', 'HEAD', 'master'];
    let manifest = null;
    let foundBranch = null;

    // Build candidate paths: if subfolder given, try it first; then root
    const candidates = subfolder
      ? [`${subfolder}/plugin.json`, 'plugin.json']
      : ['plugin.json'];

    let manifestPath = null;

    for (const branch of branches) {
      for (const candidate of candidates) {
        try {
          const res = await this._fetchGitHubRaw(owner, repo, candidate, branch, tok);
          if (res.status === 200) {
            try {
              manifest = JSON.parse(res.body.toString('utf8'));
              foundBranch = branch;
              // fetchFile paths are relative to the dir containing plugin.json
              manifestPath = candidate.includes('/') ? candidate.substring(0, candidate.lastIndexOf('/') + 1) : '';
              break;
            } catch {
              // not valid JSON
            }
          }
        } catch {
          // network error
        }
      }
      if (manifest) break;
    }

    if (!manifest) {
      const loc = subfolder ? `${owner}/${repo}/${subfolder}/plugin.json` : `${owner}/${repo}`;
      throw new RegistryError(
        `Could not find plugin.json at ${loc} — ensure the repo exists and has a plugin.json at root or in the named subfolder`
      );
    }

    const prefix = manifestPath || '';
    const fetchFile = async (relativePath) => {
      const fullPath = prefix ? `${prefix}${relativePath}` : relativePath;
      const res = await this._fetchGitHubRaw(owner, repo, fullPath, foundBranch, tok);
      if (res.status !== 200) {
        throw new RegistryError(`File not found in ${owner}/${repo}: ${fullPath} (HTTP ${res.status})`);
      }
      return res.body;
    };

    return { manifest, fetchFile };
  }

  async _resolveAlias(alias, name) {
    const registries = this._readRegistries();
    const reg = registries[alias];
    if (!reg) throw new RegistryError(`Unknown registry alias: "${alias}"`);
    // Registry URL is a GitHub org/user URL, derive repo name as alias + name
    const url = new URL(reg.url);
    const owner = url.pathname.split('/').filter(Boolean)[0];
    const repo = `${alias}-${name}`;
    return this._resolveGitHub(owner, repo, reg.token);
  }

  async _resolveLocal(dirPath) {
    const absDir = path.resolve(dirPath);
    const manifestPath = path.join(absDir, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
      throw new RegistryError(`Could not find plugin.json at ${absDir}`);
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      throw new RegistryError(`Invalid JSON in plugin.json at ${absDir}: ${e.message}`);
    }

    const fetchFile = async (relativePath) => {
      const filePath = path.join(absDir, relativePath);
      if (!fs.existsSync(filePath)) {
        throw new RegistryError(`File not found: ${filePath}`);
      }
      return fs.readFileSync(filePath);
    };

    return { manifest, fetchFile };
  }

  async resolve(source, opts = {}) {
    const parsed = this._parseSource(source);
    const subfolder = opts.plugin || parsed.impliedPlugin || null;
    switch (parsed.type) {
      case 'github':
        return this._resolveGitHub(parsed.owner, parsed.repo, null, subfolder);
      case 'local':
        return this._resolveLocal(subfolder ? path.join(parsed.path, subfolder) : parsed.path);
      case 'alias':
        return this._resolveAlias(parsed.alias, parsed.name);
      default:
        throw new RegistryError(`Unsupported source type: ${parsed.type}`);
    }
  }

  async listPlugins(source) {
    const parsed = this._parseSource(source);
    if (parsed.type === 'github') {
      return this._listGitHubPlugins(parsed.owner, parsed.repo);
    }
    if (parsed.type === 'local') {
      return this._listLocalPlugins(parsed.path);
    }
    // fallback: single plugin
    const { manifest } = await this.resolve(source);
    return [{ name: manifest.name, description: manifest.description, version: manifest.version }];
  }

  async _listGitHubPlugins(owner, repo) {
    // Use GitHub API to list root directory contents
    const tok = this.token;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/`;
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/`,
      headers: { 'User-Agent': 'proctl/0.1.0', 'Accept': 'application/vnd.github.v3+json' }
    };
    if (tok) opts.headers['Authorization'] = `token ${tok}`;

    const res = await new Promise((resolve, reject) => {
      https.get(opts, r => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(chunks) }));
      }).on('error', reject);
    });

    if (res.status !== 200) {
      // fallback: treat as single-plugin
      const { manifest } = await this._resolveGitHub(owner, repo);
      return [{ name: manifest.name, description: manifest.description, version: manifest.version }];
    }

    let entries;
    try { entries = JSON.parse(res.body.toString('utf8')); } catch { entries = []; }

    const dirs = entries.filter(e => e.type === 'dir');
    const plugins = [];

    // Check root plugin.json first
    try {
      const { manifest } = await this._resolveGitHub(owner, repo, null, null);
      plugins.push({ name: manifest.name, description: manifest.description, version: manifest.version });
      return plugins; // root plugin.json = single-plugin repo
    } catch { /* no root plugin.json, check subdirs */ }

    for (const dir of dirs) {
      try {
        const { manifest } = await this._resolveGitHub(owner, repo, null, dir.name);
        plugins.push({ name: dir.name, pluginName: manifest.name, description: manifest.description, version: manifest.version });
      } catch { /* no plugin.json in this dir */ }
    }

    return plugins;
  }

  _listLocalPlugins(dirPath) {
    const absDir = path.resolve(dirPath);
    const rootManifest = path.join(absDir, 'plugin.json');
    if (fs.existsSync(rootManifest)) {
      const m = JSON.parse(fs.readFileSync(rootManifest, 'utf8'));
      return [{ name: m.name, description: m.description, version: m.version }];
    }
    const plugins = [];
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mPath = path.join(absDir, entry.name, 'plugin.json');
      if (fs.existsSync(mPath)) {
        try {
          const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
          plugins.push({ name: entry.name, pluginName: m.name, description: m.description, version: m.version });
        } catch { /* skip */ }
      }
    }
    return plugins;
  }

  addRegistry(alias, url, token) {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    const data = this._readRegistries();
    data[alias] = { url };
    if (token) data[alias].token = token;
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Registry "${alias}" → ${url} saved.`);
  }
}

module.exports = { Registry, RegistryError };
