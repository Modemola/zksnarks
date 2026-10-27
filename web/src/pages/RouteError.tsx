import { Link, useRouteError } from "react-router-dom";
import { PageHead, Panel } from "../components/ui";

/** Shown instead of a blank page if something on a page fails unexpectedly. */
export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="wrap" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
      <PageHead eyebrow="Something went wrong" title="This page hit a problem">
        Nothing was sent or saved. Reloading usually fixes it; if not, the other pages still work.
      </PageHead>
      <Panel>
        <div className="actions" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          <button type="button" className="btn" onClick={() => location.reload()}>
            Reload the page
          </button>
          <Link className="btn secondary" to="/check" reloadDocument>
            Check a receipt
          </Link>
          <Link className="btn secondary" to="/" reloadDocument>
            Go to the overview
          </Link>
        </div>
      </Panel>
    </div>
  );
}
