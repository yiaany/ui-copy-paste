/**
 * Фирменный логотип UI Replicator.
 *
 * Минималистичная монохромная марка: два смещённых «слоя» (оригинал → копия) с
 * узлом-курсором — метафора «выбрал элемент и реплицировал его». Использует
 * currentColor, поэтому наследует акцентный цвет и работает в любой теме.
 */
interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Задний слой — «оригинал» (приглушённый контур). */}
      <rect
        x="3"
        y="3"
        width="12"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.4"
      />
      {/* Передний слой — «копия» (сплошная заливка акцентом). */}
      <rect
        x="9"
        y="9"
        width="12"
        height="12"
        rx="3"
        fill="currentColor"
      />
      {/* Узел-курсор в углу копии — «точка выбора». */}
      <circle cx="15" cy="15" r="1.6" fill="var(--c-accent-fg, #fff)" />
    </svg>
  );
}
