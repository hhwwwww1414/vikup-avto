/**
 * Renders a normalized RU plate (e.g. "О101НТ790") as "О101НТ 790" with a
 * region separator. Purely presentational.
 */
export function Plate({ value, className = "" }: { value: string; className?: string }) {
  const m = value.match(/^([АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2})(\d{2,3})$/);
  if (!m) {
    return <span className={`plate ${className}`}>{value}</span>;
  }
  return (
    <span className={`plate ${className}`}>
      <span>{m[1]}</span>
      <span className="region">{m[2]}</span>
    </span>
  );
}
