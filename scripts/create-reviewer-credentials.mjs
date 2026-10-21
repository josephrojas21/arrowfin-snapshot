import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
const traders = process.argv.slice(2);
if (!traders.length || traders.some(id => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) {
  console.error('Usage: node scripts/create-reviewer-credentials.mjs T-001 [T-005 ...]');
  process.exit(1);
}
mkdirSync('.private', { recursive: true, mode: 0o700 });
const path = '.private/reviewer-credentials.json';
if (existsSync(path)) throw new Error('Reviewer credentials already exist; preserved. Move them deliberately before generating new credentials.');
const credentials = [...new Set(traders)].map(traderId => {
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16);
  return { traderId, password, salt: salt.toString('hex'), hash: scryptSync(password, salt, 64).toString('hex') };
});
writeFileSync(path, JSON.stringify(credentials.map(({ traderId, password }) => ({ traderId, password })), null, 2), { mode: 0o600, flag: 'wx' });
writeFileSync('.private/reviewer-auth.env', 'REVIEWER_CREDENTIALS_JSON=' + JSON.stringify(credentials.map(({ password, ...record }) => record)) + '\n', { mode: 0o600, flag: 'wx' });
console.log('Credentials created in ignored .private files; values are not printed. Configure the hash-only environment value on the API service.');
