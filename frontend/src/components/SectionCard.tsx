import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName
}: SectionCardProps) {
  return (
    <section className={["section-card", className].filter(Boolean).join(" ")}>
      <header className="section-card__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="section-card__actions">{actions}</div> : null}
      </header>
      <div className={["section-card__body", bodyClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </section>
  );
}
