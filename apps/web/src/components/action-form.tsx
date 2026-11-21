"use client";

import type { ComponentProps } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { LoadingOverlay } from "./loading-overlay";

function PendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  // Portal to <body>: an ancestor with a transform or backdrop filter would trap a fixed overlay.
  return createPortal(<LoadingOverlay />, document.body);
}

/** A form for a server action: covers the screen with a loading overlay while the action runs. */
export function ActionForm({ children, ...props }: ComponentProps<"form">) {
  return (
    <form {...props}>
      {children}
      <PendingOverlay />
    </form>
  );
}
