import type { RouteObject } from "react-router-dom";
import { brand } from "./brand";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./lib/toasts";
import { Home } from "./pages/Home";

// Shared by the browser and the build-time pre-renderer (entry-server.tsx).
export const routes: RouteObject[] = [
  {
    // Notifications live inside the router: their messages can contain links.
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
