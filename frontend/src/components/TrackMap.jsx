// Small SVG rendering of a track outline (used on setup cards).
// Pass `animate` to draw the outline in with motion when the path changes.
import { motion } from 'motion/react';

export function trackViewBox(path) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of path) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(maxX - minX, maxY - minY);
  const pad = span * 0.08;
  return {
    viewBox: `${minX - pad} ${-maxY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`,
    dotRadius: span * 0.02,
  };
}

export const trackPathD = (path) =>
  path.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(-y).toFixed(1)}`).join(' ') + ' Z';

// Stroke uses currentColor, so set the colour with a text-* class on the svg.
export default function TrackMap({
  path, className = '', stroke = 'currentColor', strokeWidth = 3, animate = false, dot = 'var(--ink)',
}) {
  if (!path?.length) return null;
  const { viewBox, dotRadius } = trackViewBox(path);
  const d = trackPathD(path);

  return (
    <svg className={className} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      {animate ? (
        <>
          {/* faint full outline underneath so the shape reads while drawing */}
          <path d={d} fill="none" stroke={stroke} strokeOpacity={0.2} strokeWidth={strokeWidth}
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <motion.path
            d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round"
            strokeLinecap="round" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
          <motion.circle
            cx={path[0][0]} cy={-path[0][1]} r={dotRadius} fill={dot}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.2, type: 'spring', stiffness: 400, damping: 20 }}
            style={{ transformOrigin: `${path[0][0]}px ${-path[0][1]}px` }}
          />
        </>
      ) : (
        <>
          <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" />
          <circle cx={path[0][0]} cy={-path[0][1]} r={dotRadius} fill={dot} />
        </>
      )}
    </svg>
  );
}
