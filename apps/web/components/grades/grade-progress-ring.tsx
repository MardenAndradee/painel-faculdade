interface GradeProgressRingProps {
  /** Fração de 0 a 1 já preenchida. */
  progress: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** Anel de progresso usado nos cards de resumo da tela de Notas. */
export function GradeProgressRing({
  progress,
  color,
  size = 52,
  strokeWidth = 3,
}: GradeProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const dash = `${circumference * clamped} ${circumference}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}
