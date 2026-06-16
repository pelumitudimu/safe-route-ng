import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after mount — for browser-only libraries (e.g. Leaflet). */
export function ClientOnly({ fallback = null, children }: { fallback?: ReactNode; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
