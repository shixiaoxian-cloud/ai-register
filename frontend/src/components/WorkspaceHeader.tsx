import type { ReactNode } from "react";

interface WorkspaceHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  actions
}: WorkspaceHeaderProps) {
  return (
    <section className="workspace-header">
      <div className="workspace-header__copy">
        <div className="workspace-header__eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="workspace-header__actions">{actions}</div> : null}
    </section>
  );
}
