/** Response of GET /api/health (backend/config/health.py). */
export interface HealthResponse {
  status: "ok" | "error";
  database: "ok" | "unavailable";
}

/** Fetch the backend health status. A 503 still carries a HealthResponse body. */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
  if (!response.ok && response.status !== 503) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
