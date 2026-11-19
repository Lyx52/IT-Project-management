/**
 * "4 minutes ago", "2 days ago", or a short date once it is older than a week.
 *
 * Shared by the notification bell and the saved searches list so the two do not
 * drift apart.
 */
export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
  ];

  for (const [size, unit] of steps) {
    const next = size * (unit === 'minute' ? 60 : unit === 'hour' ? 24 : 7);

    if (seconds < next) {
      const value = Math.round(seconds / size);
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-value, unit);
    }
  }

  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
