import { describe, it, expect, mock } from 'bun:test';
mock.module('@/integrations/supabase/client', () => ({ supabase: {} }));
(globalThis as any).__APP_VERSION__ = { versionName: '1.3.5', versionCode: 348, lastUpdated: '' };
const { computeUpdateStatus, DEFAULT_RELEASE_CONFIG } = await import('../remote-updates');

const now = new Date('2026-10-27T12:00:00Z');
const base = { ...DEFAULT_RELEASE_CONFIG, grace_days: 3 };

describe('computeUpdateStatus', () => {
  it('old install inside 3-day grace is forced with days left', () => {
    const s = computeUpdateStatus({ ...base, min_version_code: 350, forced_since: '2026-10-26T12:00:00Z' }, 348, now);
    expect(s).toMatchObject({ state: 'forced', daysLeft: 2 });
  });
  it('old install after 3 days is locked', () => {
    const s = computeUpdateStatus({ ...base, min_version_code: 350, forced_since: '2026-10-24T11:00:00Z' }, 348, now);
    expect(s.state).toBe('locked');
  });
  it('install at minimum is not forced', () => {
    expect(computeUpdateStatus({ ...base, min_version_code: 348, latest_version_code: 348 }, 348, now).state).toBe('ok');
  });
  it('newer release available is optional', () => {
    expect(computeUpdateStatus({ ...base, latest_version_code: 349 }, 348, now).state).toBe('available');
  });
});
