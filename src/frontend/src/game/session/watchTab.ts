/** Calls `onAway` when the tab is hidden or the window loses focus; returns the cleanup. */
export function watchTab(onAway: () => void): () => void {
  const onVisibility = (): void => {
    if (document.hidden) onAway();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onAway);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", onAway);
  };
}
