import type { Env } from './env.ts';

/**
 * A global cap on analyses per UTC day, so a public demo cannot spend the API credit.
 * KV is eventually consistent, so under a burst the count may run a little over; that is acceptable here.
 */
export async function takeDailySlot(env: Env, now = new Date()): Promise<boolean> {
  const limit = Number(env.DAILY_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return true;
  const key = `analyses:${now.toISOString().slice(0, 10)}`;
  const used = Number((await env.COUNTERS.get(key)) ?? '0');
  if (used >= limit) return false;
  await env.COUNTERS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}
