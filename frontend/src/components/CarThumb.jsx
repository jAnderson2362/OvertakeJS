// Small car thumbnail for standings lists. Shows `src` when a car image is
// available, otherwise a placeholder silhouette tinted with the car's race
// colour so it still matches the marker on the track canvas.
export default function CarThumb({ src, color = '#F0EDEE', name = '', className = '' }) {
  return (
    <span
      className={`relative shrink-0 w-11 h-7 rounded-md overflow-hidden border border-line/60 bg-surface-2 ${className}`}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 44 28" className="w-full h-full" aria-hidden>
          <path
            d="M6 19c0-1.5 1-2.5 2.5-3l3-1 5-5c1-1 2-1.5 3.5-1.5h9c1.5 0 2.5.5 3.5 1.5l4 4.5 3.5.5c1.5.2 2.5 1.3 2.5 2.8V20c0 .8-.7 1.5-1.5 1.5H7.5C6.7 21.5 6 20.8 6 20v-1z"
            fill={color}
            opacity="0.9"
          />
          <circle cx="14" cy="21" r="2.6" fill="var(--bg-deep)" stroke={color} strokeWidth="1.2" />
          <circle cx="32" cy="21" r="2.6" fill="var(--bg-deep)" stroke={color} strokeWidth="1.2" />
        </svg>
      )}
      {/* colour stripe keeps the identity visible even once a photo is in */}
      <span className="absolute left-0 bottom-0 w-full h-0.5" style={{ background: color }} />
    </span>
  );
}
