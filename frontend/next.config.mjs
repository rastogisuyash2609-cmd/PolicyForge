// A static judging release must never silently embed the loopback API fallback.
if (process.env.POLICYFORGE_STATIC_EXPORT === "true") {
  let origin;
  try {
    origin = new URL(process.env.NEXT_PUBLIC_API_URL || "");
  } catch {
    throw new Error("Static production export requires NEXT_PUBLIC_API_URL as an HTTPS API origin.");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("NEXT_PUBLIC_API_URL must be an HTTPS origin without credentials, path or query.");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.POLICYFORGE_TEST_BUILD_DIR || ".next",
  ...(process.env.POLICYFORGE_STATIC_EXPORT === "true" ? { output: "export" } : {}),
};

export default nextConfig;
