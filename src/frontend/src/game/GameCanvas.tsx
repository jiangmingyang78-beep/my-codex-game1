import { useEffect, useRef } from "react";
import { createGame } from "./createGame";

/** Mounts one Phaser game into a full-viewport div; the effect cleanup destroys it (StrictMode-safe). */
export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    return createGame(el);
  }, []);
  return <div ref={host} className="absolute inset-0 touch-none" />;
}
