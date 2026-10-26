// Manage invite codes without ever storing the codes themselves.
//   node scripts/invite.mjs add "Ahmad"      → prints a new code, stores only its hash
//   node scripts/invite.mjs remove "Ahmad"   → revokes Ahmad's code(s)
//   node scripts/invite.mjs list             → how many codes exist and when they were added
// Each entry: per-entry salt, SHA-256 of the code, the name encrypted with the code,
// and a hashed label so a person can be found by name for removal.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'access', 'codes.json');
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest();
export const labelOf = (name) => sha(`label:${name.trim().toLowerCase()}`).toString('hex');

export function entryFor(name, code) {
  const s = crypto.randomBytes(12).toString('hex');
  const nameBytes = Buffer.from([...name.trim()].slice(0, 15).join(''), 'utf8'); // ≤ 32 bytes even for Arabic
  const key = sha(`name:${s}:${code}`);
  const enc = Buffer.alloc(Math.min(nameBytes.length, 32));
  for (let i = 0; i < enc.length; i++) enc[i] = nameBytes[i] ^ key[i];
  return { s, h: sha(`${s}:${code}`).toString('hex'), n: enc.toString('base64'), label: labelOf(name), added: new Date().toISOString().slice(0, 10) };
}

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => A[b % A.length]).join('');
  return `ARK-${pick(4)}-${pick(4)}`;
}

const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { codes: [] }; } };
const save = (d) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2) + '\n'); };

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  const name = rest.join(' ').trim();
  const d = load();
  if (cmd === 'add' && name) {
    const code = newCode();
    d.codes.push(entryFor(name, code));
    save(d);
    console.log(`${name}: ${code}`);
  } else if (cmd === 'remove' && name) {
    const before = d.codes.length;
    d.codes = d.codes.filter((c) => c.label !== labelOf(name));
    save(d);
    console.log(`removed ${before - d.codes.length} code(s) for ${name}`);
  } else if (cmd === 'list') {
    console.log(`${d.codes.length} code(s)`); d.codes.forEach((c, i) => console.log(`${i + 1}. added ${c.added}`));
  } else {
    console.log('usage: invite.mjs add "Name" | remove "Name" | list');
  }
}
