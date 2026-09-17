/** 95.482 -> "1:35.482"; sub-minute stays "35.482" */
export function formatLapTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const sStr = s.toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${sStr}` : s.toFixed(3);
}

/** Race clock: 754.2 -> "12:34" */
export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Gap to leader: "+3.412" or "+1 lap" */
export function formatGap(gapSeconds, lapsBehind) {
  if (lapsBehind > 0) return `+${lapsBehind} lap${lapsBehind > 1 ? 's' : ''}`;
  if (gapSeconds == null) return '—';
  return `+${gapSeconds.toFixed(3)}`;
}
