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
    throw new RegistryError(`Cannot parse source: "${source}"`);
  }

  async _fetchGitHubRaw(owner, repo, filePath, branch, token) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const result = await httpGet(url, token || this.token);
    return result;
  }

  async _resolveGitHub(owner, repo, token) {
    const tok = token || this.token;
    const branches = ['main', 'HEAD', 'master'];
    let manifest = null;
    let foundBranch = null;

    for (const branch of branches) {
      try {
        const res = await this._fetchGitHubRaw(owner, repo, 'plugin.json', branch, tok);
        if (res.status === 200) {
          try {
            manifest = JSON.parse(res.body.toString('utf8'));
            foundBranch = branch;
            break;
          } catch {
            // not valid JSON, try next branch
          }
        }
      } catch {
        // network error, try next
      }
    }

    if (!manifest) {
      throw new RegistryError(
        `Could not find plugin.json at ${owner}/${repo} — ensure the repo exists and has a plugin.json at root`
      );
    }

    const fetchFile = async (relativePath) => {
      const res = await this._fetchGitHubRaw(owner, repo, relativePath, foundBranch, tok);
      if (res.status !== 200) {
        throw new RegistryError(`File not found in ${owner}/${repo}: ${relativePath} (HTTP ${res.status})`);
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

  async resolve(source) {
    const parsed = this._parseSource(source);
    switch (parsed.type) {
      case 'github':
        return this._resolveGitHub(parsed.owner, parsed.repo);
      case 'local':
        return this._resolveLocal(parsed.path);
      case 'alias':
        return this._resolveAlias(parsed.alias, parsed.name);
      default:
        throw new RegistryError(`Unsupported source type: ${parsed.type}`);
    }
  }

  async listPlugins(source) {
    const { manifest, fetchFile } = await this.resolve(source);
    // Single-plugin repo
    return [{ name: manifest.name, description: manifest.description, version: manifest.version }];
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
