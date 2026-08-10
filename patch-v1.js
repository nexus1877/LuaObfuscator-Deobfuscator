const fs = require('fs');
const path = require('path');

function patchFile(filePath, patches) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const patch of patches) {
    if (typeof patch.find === 'string') {
      if (!content.includes(patch.find)) {
        console.error(`Patch failed: could not find marker in ${filePath}`);
        process.exit(1);
      }
      content = content.replace(patch.find, patch.replace);
    }
  }
  fs.writeFileSync(filePath, content);
  console.log(`Patched: ${filePath}`);
}

const ioPatches = [
  {
    find: `    const lol = calls.find((c) => c.text.startsWith('LOL!'));\n    if (lol) {\n      const fn = extractFnName(source, lol.index);\n      return { found: true, fn, preview: lol.preview };\n    }\n    const plain = findPlnLol(source);\n    if (plain.length) {\n      const p = plain[plain.length - 1];\n      return { found: true, fn: null, preview: p.text.slice(0, 24) };\n    }\n    return { found: false, fn: null, preview: null };`,
    replace: `    const lol = calls.find((c) => c.text.startsWith('LOL!'));\n    if (lol) {\n      const fn = extractFnName(source, lol.index);\n      return { found: true, fn, preview: lol.preview, plain: false };\n    }\n    const plain = findPlnLol(source);\n    if (plain.length) {\n      const p = plain[plain.length - 1];\n      return { found: true, fn: null, preview: p.text.slice(0, 24), plain: true };\n    }\n    return { found: false, fn: null, preview: null, plain: false };`
  },
  {
    find: `  let family = null;\n  if (lol.found || (wrap && opcodeScore >= 2) || (wrap && ldexp && unpack)) {\n    family = 'luaobfuscator-chaotic-evil';\n  } else if (ldexp && (tree || loop)) {\n    family = 'luaobfuscator-chaotic-evil';\n  } else if (bootstrap && !lol.found && !wrap && !ldexp) {\n    family = 'luaobfuscator-chaotic-good';\n  }`,
    replace: `  let family = null;\n  if (lol.found && lol.plain && ldexp && bootstrap) {\n    family = 'luaobfuscator-v1';\n  } else if (lol.found || (wrap && opcodeScore >= 2) || (wrap && ldexp && unpack)) {\n    family = 'luaobfuscator-chaotic-evil';\n  } else if (ldexp && (tree || loop)) {\n    family = 'luaobfuscator-chaotic-evil';\n  } else if (bootstrap && !lol.found && !wrap && !ldexp) {\n    family = 'luaobfuscator-chaotic-good';\n  }`
  },
  {
    find: `  if (family === 'luaobfuscator-chaotic-good') {\n    if (!bits.bootstrap) {\n      return { ok: false, reason: 'incomplete_good:missing_bootstrap' };\n    }\n    return { ok: true, reason: null };\n  }\n  return { ok: false, reason: 'unknown_family' };`,
    replace: `  if (family === 'luaobfuscator-chaotic-good') {\n    if (!bits.bootstrap) {\n      return { ok: false, reason: 'incomplete_good:missing_bootstrap' };\n    }\n    return { ok: true, reason: null };\n  }\n  if (family === 'luaobfuscator-v1') {\n    if (!bits.lol) {\n      return { ok: false, reason: 'incomplete_v1:missing_lol' };\n    }\n    if (!bits.ldexp) {\n      return { ok: false, reason: 'incomplete_v1:missing_vm_shape' };\n    }\n    if (!bits.bootstrap) {\n      return { ok: false, reason: 'incomplete_v1:missing_bootstrap' };\n    }\n    return { ok: true, reason: null };\n  }\n  return { ok: false, reason: 'unknown_family' };`
  }
];

const vmPatches = [
  {
    find: `function findOpLe(folded, opVar) {\n\n  const hits = [];\n  let from = 0;\n  while (from < folded.length) {\n    const at = findWd(folded, 'if', from);\n    if (at < 0) break;\n    let j = skWs(folded, at + 2);\n    if (folded[j] !== '(') {\n      from = at + 2;\n      continue;\n    }\n    j = skWs(folded, j + 1);\n    while (folded[j] === '(') j = skWs(folded, j + 1);\n    const id = rdId(folded, j);\n    if (!id || id.name !== opVar) {\n      from = at + 2;\n      continue;\n    }\n    j = skWs(folded, id.end);\n    if (folded[j] !== '<' || folded[j + 1] !== '=') {\n      from = at + 2;\n      continue;\n    }\n    j = skWs(folded, j + 2);\n    const num = rdNum(folded, j);\n    if (!num) {\n      from = at + 2;\n      continue;\n    }\n    j = skWs(folded, num.end);\n    while (folded[j] === ')') j = skWs(folded, j + 1);\n    if (!wdAt(folded, j, 'then')) {\n      from = at + 2;\n      continue;\n    }\n    hits.push({ at, bound: num.num });\n    from = at + 2;\n  }\n  return hits;\n}`,
    replace: `function findOpLe(folded, opVar) {\n\n  const hits = [];\n  let from = 0;\n  while (from < folded.length) {\n    const at = findWd(folded, 'if', from);\n    if (at < 0) break;\n    const thenAt = findWd(folded, 'then', at + 2);\n    if (thenAt < 0) {\n      from = at + 2;\n      continue;\n    }\n    const cond = folded.slice(at + 2, thenAt);\n    let j = 0;\n    while (j < cond.length) {\n      const id = rdId(cond, j);\n      if (id && id.name === opVar) {\n        let k = skWs(cond, id.end);\n        let op = null;\n        let opLen = 0;\n        if (cond.slice(k, k + 2) === '<=' || cond.slice(k, k + 2) === '>=' ||\n            cond.slice(k, k + 2) === '==' || cond.slice(k, k + 2) === '~=') {\n          op = cond.slice(k, k + 2);\n          opLen = 2;\n        } else if (cond[k] === '<' || cond[k] === '>') {\n          op = cond[k];\n          opLen = 1;\n        }\n        if (op) {\n          k = skWs(cond, k + opLen);\n          const num = rdNum(cond, k);\n          if (num) {\n            hits.push({ at, bound: num.num });\n            break;\n          }\n        }\n      }\n      j++;\n    }\n    from = at + 2;\n  }\n  return hits;\n}`
  }
];

const baseDir = process.argv[2] || '.';

patchFile(path.join(baseDir, 'Utils', 'io.js'), ioPatches);
patchFile(path.join(baseDir, 'Utils', 'vm.js'), vmPatches);

console.log('All patches applied successfully!');
