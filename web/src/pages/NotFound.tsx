import { Link } from "react-router-dom";
import { PageHead, Panel, useTitle } from "../components/ui";

/** A dead link still leads somewhere useful, including a receipt link that lost its path. */
export function NotFound() {
  useTitle("Not found");
  return (
    <>
      <PageHead eyebrow="Not found" title="This page doesn't exist">
        The link may be wrong or out of date.
      </PageHead>
      <div className="grid cols-3">
        <Panel level={2} title="Have a receipt link?" eyebrow="Check">
          <p className="small" style={{ marginTop: 0, color: "var(--ink-secondary)" }}>
            Receipt links look like <code>…/check#zr1…</code>. Paste the receipt itself on the check page.
          </p>
          <Link viewTransition className="btn small" to="/check">
            Check a receipt
          </Link>
        </Panel>
        <Panel level={2} title="Want to make one?" eyebrow="Make">
          <p className="small" style={{ marginTop: 0, color: "var(--ink-secondary)" }}>
            Find a payment you sent or received and share a receipt for just that one.
          </p>
          <Link viewTransition className="btn small secondary" to="/create">
            Make a receipt
          </Link>
        </Panel>
        <Panel level={2} title="New here?" eyebrow="Start">
          <p className="small" style={{ marginTop: 0, color: "var(--ink-secondary)" }}>
            See a real mainnet receipt checked in your browser.
          </p>
          <Link viewTransition className="btn small secondary" to="/">
            Go to the overview
          </Link>
        </Panel>
      </div>
    </>
  );
}
