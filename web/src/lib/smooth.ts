/**
 * Native scrolling everywhere. An inertia-scrolling library used to run here;
 * it added a frame of delay to every wheel movement and read as lag, so the
 * browser's own scrolling (and its smooth anchor jumps from CSS) is used instead.
 */
export function useSmoothScroll() {}

/** Jump to the top on a page change. */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}
