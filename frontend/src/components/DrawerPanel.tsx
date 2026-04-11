import { useId, type ReactNode } from "react";

import { DialogLayer } from "./DialogLayer";

interface DrawerPanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}

export function DrawerPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md"
}: DrawerPanelProps) {
  const titleId = useId();
  const subtitleId = useId();

  return (
    <DialogLayer
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={subtitle ? subtitleId : undefined}
      className="dialog-overlay--drawer"
      surfaceClassName={`drawer-panel drawer-panel--${size}`}
    >
      <header className="drawer-panel__header">
        <div className="drawer-panel__copy">
          <h3 id={titleId}>{title}</h3>
          {subtitle ? <p id={subtitleId}>{subtitle}</p> : null}
        </div>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭面板">
          ×
        </button>
      </header>
      <div className="drawer-panel__body">{children}</div>
      {footer ? <footer className="drawer-panel__footer">{footer}</footer> : null}
    </DialogLayer>
  );
}
