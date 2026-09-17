// Small SVG rendering of a track outline (used on setup cards).
export default function TrackMap({ path, className = '', stroke = '#71717a', strokeWidth = 3 }) {
  if (!path?.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of path) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  const d = path.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(-y).toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg
      className={className}
      viewBox={`${minX - pad} ${-maxY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
      <circle cx={path[0][0]} cy={-path[0][1]} r={Math.max(maxX - minX, maxY - minY) * 0.02} fill="#f4f4f5" />
    </svg>
  );
}
