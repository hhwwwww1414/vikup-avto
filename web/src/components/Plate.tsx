/**
 * Renders a normalized RU plate (e.g. "О101НТ790") as a compact Russian
 * registration plate with a separated region block.
 */
export function Plate({ value, className = "" }: { value: string; className?: string }) {
  const m = value.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/);
  if (!m) {
    return <span className={`plate-fallback ${className}`}>{value}</span>;
  }

  return (
    <span className={`ru-plate-shell ${className}`} aria-label={`${m[1]}${m[2]}${m[3]} ${m[4]}`}>
      <span className="ru-plate-grid">
        <span className="ru-plate-main">
          <span className="ru-plate-segment">{m[1]}</span>
          <span className="ru-plate-segment">{m[2]}</span>
          <span className="ru-plate-segment">{m[3]}</span>
        </span>
        <span className="ru-plate-region">
          <span className="ru-plate-region-code">{m[4]}</span>
          <span className="ru-plate-country">
            <img alt="" src="/plate-rus.svg" width="63" height="15" loading="lazy" />
          </span>
        </span>
      </span>
    </span>
  );
}
