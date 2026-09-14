// Deployment must receive explicit hosting configuration, not a developer's
// ignored .env.local. Report names only; never echo configuration values.
const required = [
  "VITE_AUTH0_DOMAIN",
  "VITE_AUTH0_CLIENT_ID",
  "VITE_AUTH0_AUDIENCE",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    `Missing required Auth0 build configuration: ${missing.join(", ")}`,
  );
  process.exitCode = 1;
}
