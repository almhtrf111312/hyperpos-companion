// Remote release control & broadcasts (Boss → all installs)
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

export interface ReleaseConfig {
  min_version_code: number;      // installs below this must update
  latest_version_name: string;
  latest_version_code: number;
  grace_days: number;            // days before lock after forced_since
  forced_since: string | null;   // ISO date when the forced rule started
  update_url: string;
  telegram_url: string;
  message: string;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'warning' | 'update' | 'maintenance';
  link_url: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export const DEFAULT_RELEASE_CONFIG: ReleaseConfig = {
  min_version_code: 0, latest_version_name: '', latest_version_code: 0,
  grace_days: 3, forced_since: null, update_url: '', telegram_url: '', message: '',
};

export const BROADCAST_TEMPLATES: { label: string; kind: Broadcast['kind']; title: string; body: string }[] = [
  { label: 'تحديث متوفر', kind: 'update', title: 'تحديث جديد متوفر', body: 'يتوفر إصدار جديد من التطبيق بتحسينات وإصلاحات. ننصح بالتحديث الآن.' },
  { label: 'تحديث إجباري (3 أيام)', kind: 'warning', title: 'تحديث إجباري', body: 'يوجد تحديث إجباري. سيتوقف هذا التطبيق بعد 3 أيام إذا لم تقم بالتحديث.' },
  { label: 'صيانة', kind: 'maintenance', title: 'صيانة مجدولة', body: 'ستتم صيانة للخادم قريباً، قد تتأخر المزامنة لفترة قصيرة.' },
  { label: 'إعلان', kind: 'info', title: 'إعلان', body: '' },
];

export const CURRENT_VERSION_CODE: number = __APP_VERSION__.versionCode;
export const CURRENT_VERSION_NAME: string = __APP_VERSION__.versionName;

export type UpdateStatus =
  | { state: 'ok' }
  | { state: 'available' }
  | { state: 'forced'; daysLeft: number; deadline: Date }
  | { state: 'locked' };

/** Pure: decide the update state for a given installed version. */
export function computeUpdateStatus(cfg: ReleaseConfig, versionCode: number, now: Date = new Date()): UpdateStatus {
  if (cfg.min_version_code > 0 && versionCode < cfg.min_version_code) {
    const start = cfg.forced_since ? new Date(cfg.forced_since) : now;
    const deadline = new Date(start.getTime() + Math.max(0, cfg.grace_days) * 86400000);
    const msLeft = deadline.getTime() - now.getTime();
    if (msLeft <= 0) return { state: 'locked' };
    return { state: 'forced', daysLeft: Math.ceil(msLeft / 86400000), deadline };
  }
  if (cfg.latest_version_code > versionCode) return { state: 'available' };
  return { state: 'ok' };
}

const CFG_KEY = 'hp_release_config_cache';
const SEEN_KEY = 'hp_seen_broadcasts';

export function getCachedReleaseConfig(): ReleaseConfig {
  try { return { ...DEFAULT_RELEASE_CONFIG, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') }; }
  catch { return DEFAULT_RELEASE_CONFIG; }
}

export async function fetchReleaseConfig(): Promise<ReleaseConfig> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'release_config').maybeSingle();
  if (error) return getCachedReleaseConfig();
  let cfg = DEFAULT_RELEASE_CONFIG;
  try { cfg = { ...DEFAULT_RELEASE_CONFIG, ...JSON.parse(data?.value || '{}') }; } catch { /* keep default */ }
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  return cfg;
}

export async function saveReleaseConfig(cfg: ReleaseConfig) {
  const value = JSON.stringify(cfg);
  const { data } = await supabase.from('app_settings').select('id').eq('key', 'release_config').maybeSingle();
  if (data?.id) return supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', data.id);
  return supabase.from('app_settings').insert({ key: 'release_config', value });
}

export async function fetchActiveBroadcasts(): Promise<Broadcast[]> {
  const { data } = await supabase.from('app_broadcasts').select('*').eq('is_active', true)
    .order('created_at', { ascending: false }).limit(10);
  const now = Date.now();
  return ((data || []) as Broadcast[]).filter(b => !b.expires_at || new Date(b.expires_at).getTime() > now);
}

export function getSeenBroadcasts(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
export function markBroadcastSeen(id: string) {
  const s = new Set(getSeenBroadcasts()); s.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-100)));
}

export async function reportClientVersion(userId: string) {
  await supabase.from('client_versions').upsert({
    user_id: userId, version_name: CURRENT_VERSION_NAME, version_code: CURRENT_VERSION_CODE,
    platform: Capacitor.getPlatform(), last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export function openExternal(url: string) {
  if (!url) return;
  window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer');
}
