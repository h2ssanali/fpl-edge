// Builds public/access.json (what the site checks) from:
//  1) access/codes.json — hashed invite codes managed with scripts/invite.mjs, and
//  2) the optional ACCESS_CODES GitHub secret ("Name: CODE" per line).
// No codes at all → the site stays open to everyone.
import fs from 'node:fs';
import path from 'node:path';
import { entryFor } from './invite.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const normalize = (code) => code.toUpperCase().replace(/\s+/g, '');

let committed = [];
try { committed = JSON.parse(fs.readFileSync(path.join(ROOT, 'access', 'codes.json'), 'utf8')).codes ?? []; } catch { /* none */ }
const fromSecret = (process.env.ACCESS_CODES || '').split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).map((line) => {
  const i = line.lastIndexOf(':');
  return i >= 0 ? { name: line.slice(0, i).trim(), code: normalize(line.slice(i + 1)) } : { name: '', code: normalize(line) };
}).filter((p) => p.code.length >= 4).map((p) => entryFor(p.name, p.code));

const codes = [...committed, ...fromSecret].map(({ s, h, n }) => ({ s, h, n }));
fs.writeFileSync(path.join(ROOT, 'public', 'access.json'), JSON.stringify(codes.length ? { enabled: true, codes } : { enabled: false }));
console.log(codes.length ? `access: ${codes.length} invite code(s)` : 'access: open to everyone');
