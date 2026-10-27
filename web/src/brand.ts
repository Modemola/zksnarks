/**
 * Everything that names the product, in one place. The header, footer, page
 * titles and pre-rendered HTML all read from here.
 */
export const brand = {
  name: "Unseal",
  /** The home page's <title>, also used in link previews. */
  title: "Unseal: prove one Zcash payment, keep the rest private",
  /** Footer line. */
  tagline: "Unseal. Receipts for shielded Zcash payments: one payment shown, everything else sealed.",
  sourceUrl: "https://github.com/modemola/zksnarks",
  /** Header links, in order. `end` marks the home link. */
  nav: [
    { to: "/", label: "Overview", end: true },
    { to: "/check", label: "Check a receipt" },
    { to: "/create", label: "Make a receipt" },
    { to: "/how", label: "How it works" },
  ],
  /** A notice chip in the header. Null when there is nothing to flag. */
  notice: null as { chip: string; text: string } | null,
};
