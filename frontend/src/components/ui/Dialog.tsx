import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";

interface DialogProps {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  /** Buttons; stacked full-width on phones, right-aligned on desktop. Put the main button last. */
  actions: ReactNode;
  /** Omit to make the dialog impossible to dismiss with Esc or the backdrop (city prompt, US-04). */
  onClose?: () => void;
}

/** Centred modal box, max 400 px wide (ui_design.md §3.2). */
export function Dialog({ title, icon, children, actions, onClose }: DialogProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ui-dialog-layer" onClick={onClose}>
      <div className="ui-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        {icon && <div className="ui-dialog__icon">{icon}</div>}
        <h2 className="ui-dialog__title">{title}</h2>
        {children && <div className="ui-dialog__body">{children}</div>}
        <div className="ui-dialog__actions">{actions}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title?: string;
  /** One sentence about the consequence. */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure?" preset with a red confirm button (US-06, US-10, US-25). */
export function ConfirmDialog({ title = "Are you sure?", message, confirmLabel, cancelLabel = "Keep", onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Dialog>
  );
}
