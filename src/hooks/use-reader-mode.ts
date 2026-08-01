import { useEffect, useState } from "react";

const KEY = "saferoute-reader-mode";

/**
 * Distraction-free reading view preference. Read after mount so SSR markup
 * and the first client render always match.
 */
export function useReaderMode() {
  const [reader, setReader] = useState(false);

  useEffect(() => {
    setReader(localStorage.getItem(KEY) === "1");
  }, []);

  const toggle = () => {
    setReader((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  };

  return { reader, toggle };
}
