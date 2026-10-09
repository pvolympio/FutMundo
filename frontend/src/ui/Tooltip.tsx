import { useState, useRef } from 'react';

/** Tooltip com posicionamento automático */
export function Tooltip({
  children,
  content,
  position = 'top',
}: {
  children: React.ReactNode;
  content: React.ReactNode | string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={triggerRef}
      className="tooltip-trigger"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${position}`}
          role="tooltip"
          aria-label={typeof content === 'string' ? content : undefined}
        >
          {content}
        </div>
      )}
    </div>
  );
}