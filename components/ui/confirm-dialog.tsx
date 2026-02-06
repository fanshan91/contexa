"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type ConfirmDialogProps = {
  trigger: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
};

function ConfirmDialog({
  trigger,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  confirmVariant = "destructive",
  disabled = false,
  onConfirm
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
        setOpen(nextOpen);
      }}
      trigger={trigger}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={disabled}>
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={() => {
              setOpen(false);
              void onConfirm();
            }}
            disabled={disabled}
          >
            {confirmText}
          </Button>
        </>
      }
    />
  );
}

const CtxConfirmDialog = ConfirmDialog;

export { ConfirmDialog, CtxConfirmDialog };
