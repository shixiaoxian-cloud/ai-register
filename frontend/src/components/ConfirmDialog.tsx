import { useId } from "react";

import { DialogLayer } from "./DialogLayer";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "accent";
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "danger",
  confirming = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogLayer
      open={open}
      onClose={confirming ? () => undefined : onCancel}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      surfaceClassName="confirm-dialog"
    >
      <div className={`confirm-dialog__icon confirm-dialog__icon--${tone}`} aria-hidden="true">
        {tone === "danger" ? "!" : "i"}
      </div>
      <div className="confirm-dialog__copy">
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId}>{description}</p>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === "danger" ? "danger-button" : "accent-button"}
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? "处理中..." : confirmLabel}
        </button>
      </footer>
    </DialogLayer>
  );
}
