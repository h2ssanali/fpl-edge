// Builds public/access.json from the ACCESS_CODES secret (GitHub → Settings → Secrets).
// Format: one person per line, "Name: CODE" (a plain "CODE" also works).
// Only salted SHA-256 hashes are published; names are encrypted with each person's own code.
// No secret → no file content → the site stays open to everyone.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'access.json');
export const normalize = (code) => code.toUpperCase().replace(/\s+/g, '');
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest();

const raw = process.env.ACCESS_CODES || '';
const people = raw.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).map((line) => {
  const i = line.lastIndexOf(':');
  return i >= 0 ? { name: line.slice(0, i).trim(), code: normalize(line.slice(i + 1)) } : { name: '', code: normalize(line) };
}).filter((p) => p.code.length >= 4);

if (!people.length) {
  fs.writeFileSync(OUT, JSON.stringify({ enabled: false }));
  console.log('access: open to everyone (no ACCESS_CODES secret)');
} else {
  const salt = crypto.randomBytes(16).toString('hex');
  const codes = people.map(({ name, code }) => {
    const nameBytes = Buffer.from(name.slice(0, 40), 'utf8');
    const key = sha(`name:${salt}:${code}`);
    const enc = Buffer.alloc(Math.min(nameBytes.length, 32));
    for (let i = 0; i < enc.length; i++) enc[i] = nameBytes[i] ^ key[i];
    return { h: sha(`${salt}:${code}`).toString('hex'), n: enc.toString('base64') };
  });
  fs.writeFileSync(OUT, JSON.stringify({ enabled: true, salt, codes }));
  console.log(`access: ${codes.length} invite code(s)`);
}
