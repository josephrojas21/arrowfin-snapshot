import { test, expect, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
const api = 'http://127.0.0.1:4000';
const tag = randomUUID().slice(0, 8);
const trader = `E2E-${tag}`, peer = `E2E-peer-${tag}`, outsider = `E2E-other-${tag}`;
const account = `E2E-account-${tag}`, peerAccount = `E2E-peer-account-${tag}`, otherAccount = `E2E-other-account-${tag}`;
const db = new PrismaClient();
let createdInstrument = false;
async function login(request: APIRequestContext, id = trader) {
  const response = await request.post(`${api}/api/dev/login`, { data: { traderId: id } });
  expect(response.status()).toBe(201);
  return (await response.json()).accessToken as string;
}
function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(api, { auth: { token }, reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => { socket.close(); reject(error); });
  });
}
test.beforeAll(async () => {
  if (!await db.instrument.findUnique({ where: { symbol: 'MES' } })) {
    await db.instrument.create({ data: { symbol: 'MES', pointValue: '5', initialMargin: '1320', markPrice: '5648.75' } });
    createdInstrument = true;
  }
  for (const [id, brokerId, aid] of [[trader, 'E2E-B1', account], [peer, 'E2E-B1', peerAccount], [outsider, 'E2E-B2', otherAccount]]) {
    await db.trader.create({ data: { id, brokerId } });
    await db.account.create({ data: { id: aid, traderId: id, brokerId, status: 'active', balance: '10000' } });
  }
});
test.afterAll(async () => {
  await db.fill.deleteMany({ where: { accountId: { in: [account, peerAccount, otherAccount] } } });
  await db.account.deleteMany({ where: { id: { in: [account, peerAccount, otherAccount] } } });
  await db.trader.deleteMany({ where: { id: { in: [trader, peer, outsider] } } });
  if (createdInstrument) await db.instrument.delete({ where: { symbol: 'MES' } });
  await db.$disconnect();
});
test('HTTP ownership rejects other trader and other broker, with minimal DTO', async ({ request }) => {
  expect((await request.get(`${api}/api/me/snapshot`)).status()).toBe(401);
  const token = await login(request);
  const headers = { Authorization: `Bearer ${token}` };
  for (const id of [peerAccount, otherAccount]) {
    const response = await request.post(`${api}/api/dev/fills`, { headers, data: { account_id: id, instrument_symbol: 'MES', side: 'BUY', quantity: 1, price: '5643.25', commission_usd: '1.40' } });
    expect(response.status()).toBe(403);
  }
  const response = await request.get(`${api}/api/me/snapshot`, { headers });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  const body = await response.json();
  expect(body.accounts.map((a: { id: string }) => a.id)).toEqual([account]);
  expect(body.session).toEqual({start:'2026-08-24T22:00:00.000Z',end:'2026-08-25T21:00:00.000Z',timeZone:'America/Chicago'});
  expect(Object.keys(body).sort()).toEqual(['accounts','asOf','session','version']);
  expect(Object.keys(body.accounts[0]).sort()).toEqual(['balance','commissions','id','positions','realizedPnl','riskReason','riskScore','status','unrealizedPnl']);
});
test('real fill persists, updates browser and never broadcasts to another identity', async ({ page, request }) => {
  const token = await login(request), peerToken = await login(request, peer), otherToken = await login(request, outsider);
  const sockets = await Promise.all([connect(token), connect(peerToken), connect(otherToken)]);
  const events: unknown[][] = [[], [], []];
  sockets.forEach((socket, i) => socket.on('snapshot.updated', payload => events[i].push(payload)));
  try {
    await page.goto('/');
    await page.getByLabel('Demo trader').selectOption(trader);
    await page.getByRole('button', { name: 'Enter workspace' }).click();
    await expect(page.getByText('Live connection', { exact: true })).toBeVisible();
    await expect(page.getByText('No open positions', { exact: true })).toBeVisible();
    const response = await request.post(`${api}/api/dev/fills`, { headers: { Authorization: `Bearer ${token}` }, data: { account_id: account, instrument_symbol: 'MES', side: 'BUY', quantity: 2, price: '5643.25', commission_usd: '1.40' } });
    expect(response.status()).toBe(201);
    await expect(page.getByRole('cell', { name: 'MES', exact: true })).toBeVisible();
    await expect(page.getByText('Elevated risk', { exact: false })).toBeVisible();
    await expect.poll(() => events[0].length).toBe(1);
    expect(events[1]).toEqual([]); expect(events[2]).toEqual([]);
    expect(Object.keys(events[0][0] as object)).toEqual(['version']);
    expect(await db.fill.count({ where: { accountId: account } })).toBe(1);
    const result = await request.get(`${api}/api/me/snapshot`, { headers: { Authorization: `Bearer ${token}` } });
    const snapshot = await result.json();
    expect(snapshot.accounts[0].realizedPnl).toBe('-2.80');
    expect(snapshot.accounts[0].riskScore).toBe(100);
    await page.screenshot({ path: '/tmp/arrowfin-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Daily snapshot.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/arrowfin-mobile.png', fullPage: true });
    await page.context().setOffline(true);
    await expect(page.getByText('Data may be stale', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.context().setOffline(false);
    await expect(page.getByText('Live connection', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Open your workspace' })).toBeVisible();
    await page.getByLabel('Demo trader').selectOption(peer);
    await page.getByRole('button', { name: 'Enter workspace' }).click();
    await expect(page.getByText('No open positions', { exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'MES', exact: true })).toHaveCount(0);
  } finally { sockets.forEach(s => s.disconnect()); }
});
test('anonymous socket fails during handshake', async () => {
  await expect(connect('invalid')).rejects.toThrow();
});

test('expired socket session hides financial data and requests sign-in', async ({ page }) => {
  const accessToken = jwt.sign({ brokerId: 'E2E-B1' }, process.env.JWT_SECRET!, {
    subject: trader, algorithm: 'HS256', expiresIn: '4s', audience: 'arrowfin', issuer: 'arrowfin-api',
  });
  await page.route('**/api/dev/login', route => route.fulfill({ json: { accessToken, trader: { id: trader, brokerId: 'E2E-B1' } } }));
  await page.goto('/');
  await page.getByLabel('Demo trader').selectOption(trader);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByText('Live connection', { exact: true })).toBeVisible();
  await expect(page.getByText('Sign-in required', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to sign-in' })).toBeVisible();
});
test('API failure is visible and recoverable', async ({ page }) => {
  await page.route('**/api/me/snapshot', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
  await page.goto('/');
  await page.getByLabel('Demo trader').selectOption(peer);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Unable to load your snapshot' })).toBeVisible({ timeout: 10_000 });
  await page.unroute('**/api/me/snapshot');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No open positions', { exact: true })).toBeVisible();
});

test('local simulator submits a real fill from the UI', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Demo trader').selectOption(peer);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.getByText('Simulate a fill', { exact: false }).click();
  await page.getByLabel('Instrument', { exact: true }).fill('MES');
  await page.getByLabel('Quantity', { exact: true }).fill('1');
  await page.getByLabel('Execution price', { exact: true }).fill('5643.25');
  await page.getByLabel('Commission / contract (USD)', { exact: true }).fill('1.40');
  await page.getByRole('button', { name: 'Submit simulated execution' }).click();
  await expect(page.getByText('Simulated execution recorded.', { exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'MES', exact: true })).toBeVisible();
  expect(await db.fill.count({ where: { accountId: peerAccount } })).toBe(1);
});
