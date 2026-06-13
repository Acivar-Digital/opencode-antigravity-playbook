export function parseDurationString(s: string): number | null {
  if (!s || typeof s !== 'string') return null;

  // e.g., "2h1m25.5s" or "500ms"
  const regex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?/;
  const match = s.match(regex);

  if (!match || match[0] === '') {
    return null;
  }

  const hours = parseFloat(match[1] || '0');
  const minutes = parseFloat(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  const milliseconds = parseFloat(match[4] || '0');

  const totalMilliseconds = 
    hours * 3600000 + 
    minutes * 60000 + 
    seconds * 1000 + 
    milliseconds;

  return totalMilliseconds === 0 ? null : Math.ceil(totalMilliseconds);
}
