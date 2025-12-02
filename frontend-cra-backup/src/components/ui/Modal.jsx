"use client";
import { useEffect } from "react";
import Portal from "./Portal";

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return (
    <Portal>
      <div
        aria-modal="true"
        role="dialog"
        className="fixed inset-0 z-[20000] flex items-center justify-center"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative z-[20001] w-[min(96vw,520px)] max-h-[90vh] overflow-auto rounded-2xl glass-strong p-4 shadow-2xl">
          {children}
        </div>
      </div>
    </Portal>
  );
}