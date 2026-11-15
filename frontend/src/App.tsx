import { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "./api/health";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; health: HealthResponse }
  | { kind: "failed"; message: string };

/** Skeleton page: shows the live end-to-end health of browser -> nginx -> backend -> db. */
export default function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetchHealth()
      .then((health) => setState({ kind: "loaded", health }))
      .catch((error: unknown) =>
        setState({ kind: "failed", message: error instanceof Error ? error.message : "Unknown error" }),
      );
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <h1>EventMap</h1>
      {state.kind === "loading" && <p>Checking API…</p>}
      {state.kind === "loaded" && (
        <p>
          API: <strong>{state.health.status}</strong> · Database: <strong>{state.health.database}</strong>
        </p>
      )}
      {state.kind === "failed" && <p>API unreachable: {state.message}</p>}
    </main>
  );
}
