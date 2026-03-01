"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function Portal({ children, rootId = "zt-portal-root" }) {
  const [mounted, setMounted] = useState(false);
  const portalRoot = useMemo(() => {
    if (typeof window === "undefined") return null;
    let el = document.getElementById(rootId);
    if (!el) {
      el = document.createElement("div");
      el.id = rootId;
      document.body.appendChild(el);
    }
    return el;
  }, [rootId]);
  useEffect(() => setMounted(true), []);
  if (!mounted || !portalRoot) return null;
  return createPortal(children, portalRoot);
}