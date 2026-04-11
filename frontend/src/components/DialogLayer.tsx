import { useEffect, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogLayerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  closeOnOverlay?: boolean;
}

function stopPropagation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function DialogLayer({
  open,
  onClose,
  children,
  className,
  surfaceClassName,
  labelledBy,
  describedBy,
  role = "dialog",
  closeOnOverlay = true
}: DialogLayerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.classList.add("dialog-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("dialog-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={["dialog-overlay", className].filter(Boolean).join(" ")}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={["dialog-surface", surfaceClassName].filter(Boolean).join(" ")}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onClick={stopPropagation}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
