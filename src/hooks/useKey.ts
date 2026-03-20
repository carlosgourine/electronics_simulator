import { useEffect } from "react";

export function useKey(handler: (event: KeyboardEvent) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handler(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
