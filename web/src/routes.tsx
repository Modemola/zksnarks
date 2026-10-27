import type { RouteObject } from "react-router-dom";
import { brand } from "./brand";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./lib/toasts";
import { Home } from "./pages/Home";
import { RouteError } from "./pages/RouteError";

// Shared by the browser and the build-time pre-renderer (entry-server.tsx).
export const routes: RouteObject[] = [
  {
    // Notifications live inside the router: their messages can contain links.
    errorElement: <RouteError />,
    element: (
      <ToastProvider>
        <Layout />
      </ToastProvider>
    ),
    children: [
      // The landing page ships with the app; every other page loads its own
      // code when it's first visited.
      { index: true, element: <Home /> },
      { path: "check", lazy: async () => ({ Component: (await import("./pages/CheckPage")).CheckPage }) },
      { path: "create", lazy: async () => ({ Component: (await import("./pages/CreatePage")).CreatePage }) },
      { path: "how", lazy: async () => ({ Component: (await import("./pages/HowPage")).HowPage }) },
      { path: "*", lazy: async () => ({ Component: (await import("./pages/NotFound")).NotFound }) },
    ],
  },
];

/**
 * Pages whose first render needs no data from the network, so the build can
 * pre-render them to HTML (path → <title>). Data-driven pages render in the browser.
 */
export const PRERENDERED: Record<string, string> = {
  "/": brand.title,
  "/check": `Check a receipt · ${brand.name}`,
  "/create": `Make a receipt · ${brand.name}`,
  "/how": `How it works · ${brand.name}`,
};

/** Each pre-rendered page's description, for search results and link previews. */
export const DESCRIPTIONS: Record<string, string> = {
  "/": "Receipts for shielded Zcash payments. Prove one payment to an accountant, a shop or a court without opening your wallet. Checked in the browser.",
  "/check": "Check an Unseal receipt in your browser: it opens one shielded Zcash payment, matches it to the chain, and reveals nothing else.",
  "/create": "Make a receipt for one shielded Zcash payment you sent or received. Your viewing key never leaves the page.",
  "/how": "How Unseal receipts work: one payment opened from three facts, checked against the Zcash chain, and why a receipt can't lie.",
};
