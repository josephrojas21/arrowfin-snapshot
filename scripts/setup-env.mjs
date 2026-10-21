import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) {
  console.log('.env already exists; preserved.');
} else {
  const password = randomBytes(24).toString('hex');
  writeFileSync('.env', [
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgresql://arrowfin:${password}@127.0.0.1:55439/arrowfin?schema=public`,
    `JWT_SECRET=${randomBytes(48).toString('hex')}`,
    'ENABLE_DEV_TOOLS=true', 'NODE_ENV=development', 'PORT=4000',
    'WEB_ORIGIN=http://127.0.0.1:3000', 'SNAPSHOT_NOW=2026-08-25T14:30:00Z',
    'DATASET_DIR=./dataset', ''
  ].join('\n'), { mode: 0o600, flag: 'wx' });
  console.log('Created local .env with random credentials; values are not printed.');
}
