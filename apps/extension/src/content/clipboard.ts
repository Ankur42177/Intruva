/**
 * Copy text to the clipboard from a user gesture. Uses the async Clipboard API
 * and falls back to a temporary textarea + execCommand("copy"), so no
 * `clipboardWrite` permission is needed.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.setAttribute("aria-hidden", "true");
  ta.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0;";
  const prev = document.activeElement as HTMLElement | null;
  document.documentElement.appendChild(ta);
  try {
    ta.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
    prev?.focus?.();
  }
}
