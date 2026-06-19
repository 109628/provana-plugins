'use strict';

async function installSkill(skillDef, fetchFile, agentAdapter, opts = {}) {
  const files = {};
  const skillPath = skillDef.path;
  const skillMdPath = skillPath.endsWith('/SKILL.md') ? skillPath : `${skillPath}/SKILL.md`;

  const content = await fetchFile(skillMdPath);
  files['SKILL.md'] = content;

  // Try to fetch optional REFERENCE.md
  try {
    const refPath = skillPath.endsWith('/SKILL.md')
      ? skillPath.replace('SKILL.md', 'REFERENCE.md')
      : `${skillPath}/REFERENCE.md`;
    const refContent = await fetchFile(refPath);
    files['REFERENCE.md'] = refContent;
  } catch {
    // optional — ignore
  }

  agentAdapter.installSkill(skillDef.name || skillMdPath.split('/').slice(-2)[0], files, opts);
  return files;
}

async function removeSkill(name, agentAdapter, opts = {}) {
  agentAdapter.removeSkill(name, opts);
}

module.exports = { installSkill, removeSkill };
