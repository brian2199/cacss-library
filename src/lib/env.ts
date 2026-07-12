/** True when running a production Node/Next build or deployment. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True for local development (`next dev`). */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Demo seed password — development only; never shown in production UI. */
export const DEV_DEMO_PASSWORD = "cacss-demo";
