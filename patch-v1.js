const fs = require('fs');
const path = require('path');

function patchFile(filePath, patches) {
 let content = fs.readFileSync(filePath, 'utf8');
 for (const patch of patches) {
   if (typeof patch.find === 'string') {
     if (!content.includes(patch.find)) {
       console.error('Patch failed: could not find marker in ' + filePath);
       process.exit(1);
     }
     content = content.replace(patch.find, patch.replace);
   }
 }
 fs.writeFileSync(filePath, content);
 console.log('Patched: ' + filePath);
}

const ioPatches = [
 {
   find: `    const lol = calls.find((c) => c.text.startsWith('LOL!'));
   if (lol) {
     const fn = extractFnName(source, lol.index);
     return { found: true, fn, preview: lol.preview };
   }
   const plain = findPlnLol(source);
   if (plain.length) {
     const p = plain[plain.length - 1];
     return { found: true, fn: null, preview: p.text.slice(0, 24) };
   }
   return { found: false, fn: null, preview: null };`,
   replace: `    const lol = calls.find((c) => c.text.startsWith('LOL!'));
   if (lol) {
     const fn = extractFnName(source, lol.index);
     return { found: true, fn, preview: lol.preview, plain: false };
   }
   const plain = findPlnLol(source);
   if (plain.length) {
     const p = plain[plain.length - 1];
     return { found: true, fn: null, preview: p.text.slice(0, 24), plain: true };
   }
   return { found: false, fn: null, preview: null, plain: false };`
 },
 {
   find: `  let family = null;
 if (lol.found || (wrap && opcodeScore >= 2) || (wrap && ldexp && unpack)) {
   family = 'luaobfuscator-chaotic-evil';
 } else if (ldexp && (tree || loop)) {
   family = 'luaobfuscator-chaotic-evil';
 } else if (bootstrap && !lol.found && !wrap && !ldexp) {
   family = 'luaobfuscator-chaotic-good';
 }`,
   replace: `  let family = null;
 if (lol.found && lol.plain && ldexp && bootstrap) {
   family = 'luaobfuscator-v1';
 } else if (lol.found || (wrap && opcodeScore >= 2) || (wrap && ldexp && unpack)) {
   family = 'luaobfuscator-chaotic-evil';
 } else if (ldexp && (tree || loop)) {
   family = 'luaobfuscator-chaotic-evil';
 } else if (bootstrap && !lol.found && !wrap && !ldexp) {
   family = 'luaobfuscator-chaotic-good';
 }`
 },
 {
   find: `  if (family === 'luaobfuscator-chaotic-good') {
   if (!bits.bootstrap) {
     return { ok: false, reason: 'incomplete_good:missing_bootstrap' };
   }
   return { ok: true, reason: null };
 }
 return { ok: false, reason: 'unknown_family' };`,
   replace: `  if (family === 'luaobfuscator-chaotic-good') {
   if (!bits.bootstrap) {
     return { ok: false, reason: 'incomplete_good:missing_bootstrap' };
   }
   return { ok: true, reason: null };
 }
 if (family === 'luaobfuscator-v1') {
   if (!bits.lol) {
     return { ok: false, reason: 'incomplete_v1:missing_lol' };
   }
   if (!bits.ldexp) {
     return { ok: false, reason: 'incomplete_v1:missing_vm_shape' };
   }
   if (!bits.bootstrap) {
     return { ok: false, reason: 'incomplete_v1:missing_bootstrap' };
   }
   return { ok: true, reason: null };
 }
 return { ok: false, reason: 'unknown_family' };`
 }
];

const vmPatches = [
 {
   find: `function findOpLe(folded, opVar) {

 const hits = [];
 let from = 0;
 while (from < folded.length) {
   const at = findWd(folded, 'if', from);
   if (at < 0) break;
   let j = skWs(folded, at + 2);
   if (folded[j] !== '(') {
     from = at + 2;
     continue;
   }
   j = skWs(folded, j + 1);
   while (folded[j] === '(') j = skWs(folded, j + 1);
   const id = rdId(folded, j);
   if (!id || id.name !== opVar) {
     from = at + 2;
     continue;
   }
   j = skWs(folded, id.end);
   if (folded[j] !== '<' || folded[j + 1] !== '=') {
     from = at + 2;
     continue;
   }
   j = skWs(folded, j + 2);
   const num = rdNum(folded, j);
   if (!num) {
     from = at + 2;
     continue;
   }
   j = skWs(folded, num.end);
   while (folded[j] === ')') j = skWs(folded, j + 1);
   if (!wdAt(folded, j, 'then')) {
     from = at + 2;
     continue;
   }
   hits.push({ at, bound: num.num });
   from = at + 2;
 }
 return hits;
}`,
   replace: `function findOpLe(folded, opVar) {

 const hits = [];
 let from = 0;
 while (from < folded.length) {
   const at = findWd(folded, 'if', from);
   if (at < 0) break;
   const thenAt = findWd(folded, 'then', at + 2);
   if (thenAt < 0) {
     from = at + 2;
     continue;
   }
   const cond = folded.slice(at + 2, thenAt);
   let j = 0;
   while (j < cond.length) {
     const id = rdId(cond, j);
     if (id && id.name === opVar) {
       let k = skWs(cond, id.end);
       let op = null;
       let opLen = 0;
       if (cond.slice(k, k + 2) === '<=' || cond.slice(k, k + 2) === '>=' ||
           cond.slice(k, k + 2) === '==' || cond.slice(k, k + 2) === '~=') {
         op = cond.slice(k, k + 2);
         opLen = 2;
       } else if (cond[k] === '<' || cond[k] === '>') {
         op = cond[k];
         opLen = 1;
       }
       if (op) {
         k = skWs(cond, k + opLen);
         const num = rdNum(cond, k);
         if (num) {
           hits.push({ at, bound: num.num });
           break;
         }
       }
     }
     j++;
   }
   from = at + 2;
 }
 return hits;
}`
 }
];

const baseDir = process.argv[2] || '.';

patchFile(path.join(baseDir, 'Utils', 'io.js'), ioPatches);
patchFile(path.join(baseDir, 'Utils', 'vm.js'), vmPatches);

console.log('All patches applied successfully!');
