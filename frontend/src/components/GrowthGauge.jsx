export default function GrowthGauge({ score = 0, size = 200 }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;
  // semicircle from 180deg to 0deg
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - (clamped / 100) * (startAngle - endAngle);

  const polar = (a, r = radius) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [sx, sy] = polar(startAngle);
  const [ex, ey] = polar(endAngle);
  const [px, py] = polar(angle);

  const color = clamped >= 75 ? "hsl(var(--success))" : clamped >= 50 ? "hsl(var(--primary))" : "hsl(var(--destructive))";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <path d={`M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
        <path d={`M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${px} ${py}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="butt" />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = startAngle - (t / 100) * (startAngle - endAngle);
          const [tx, ty] = polar(a, radius + 14);
          return <text key={t} x={tx} y={ty} fontSize="9" fontFamily="JetBrains Mono" fill="hsl(var(--muted-foreground))" textAnchor="middle">{t}</text>;
        })}
      </svg>
      <div className="-mt-16 text-center">
        <div className="font-mono text-5xl font-bold tracking-tighter" data-testid="growth-score-value">{clamped}</div>
        <div className="label-mono mt-1">Growth Score</div>
      </div>
    </div>
  );
}
