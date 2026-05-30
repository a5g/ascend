import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

const remoteHost = process.env.VITE_REMOTE_HOST || "localhost";
const apiHost = process.env.VITE_API_HOST || "localhost";
const apiBaseUrl = `http://${apiHost}:3000`;

// In production set VITE_MFE_<NAME>_URL to the full remoteEntry.js URL for each deployed MFE.
// Falls back to localhost:<port> for local development.
const mfeEntry = (envVar: string, port: number) =>
  process.env[envVar] ?? `http://${remoteHost}:${port}/remoteEntry.js`;

// Patches the MF entry bootstrap module to make offline remotes non-fatal.
//
// The generated bootstrap (getBootstrapSource) looks like:
//   (async () => {
//     const { initHost } = await import(initSrc);
//     const runtime = await initHost();
//     const __mfRemotePreloads = [runtime.loadRemote('mfe_x/Comp'), ...];
//     await Promise.all(__mfRemotePreloads);   // ← RUNTIME-008 thrown here
//   })().then(() => import(entrySrc));          // ← skipped on rejection → blank page
//
// Fix 1: replace Promise.all with Promise.allSettled so offline remotes don't reject.
// Fix 2: add .catch() before .then() as a belt-and-suspenders guard.
//
// The transform hook covers virtual modules in dev mode; generateBundle covers the
// mf-entry-bootstrap-0.js file emitted as a static asset by @module-federation/vite
// during production builds (emitted after the transform stage, so transform misses it).
function mfeBootstrapResilientPlugin(): Plugin {
  function patchBootstrap(code: string): string | null {
    if (!code.includes("__mfRemotePreloads")) return null;
    const patched = code
      .replace(/await Promise\.all\(__mfRemotePreloads\)/g, "await Promise.allSettled(__mfRemotePreloads)")
      .replace(
        /\}\)\(\)\.then\(/g,
        '})().catch(function(e){console.warn("[MFE] Bootstrap error suppressed:",String(e&&e.message||e).split("\\n")[0]);}).then(',
      );
    return patched === code ? null : patched;
  }

  return {
    name: "mfe-bootstrap-resilient",
    enforce: "post",
    transform(code: string) {
      const patched = patchBootstrap(code);
      if (!patched) return null;
      return { code: patched, map: null };
    },
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const chunk of Object.values(bundle)) {
        if (!chunk || typeof chunk !== "object") continue;
        const c = chunk as Record<string, unknown>;
        if (c["type"] === "chunk" && typeof c["code"] === "string") {
          const patched = patchBootstrap(c["code"] as string);
          if (patched) c["code"] = patched;
        } else if (c["type"] === "asset" && typeof c["source"] === "string") {
          const patched = patchBootstrap(c["source"] as string);
          if (patched) c["source"] = patched;
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "web_shell",
      remotes: {
        mfe_dashboard: {
          type: "var",
          name: "mfe_dashboard",
          entry: mfeEntry("VITE_MFE_DASHBOARD_URL", 4001),
        },
        mfe_position_sizing: {
          type: "var",
          name: "mfe_position_sizing",
          entry: mfeEntry("VITE_MFE_POSITION_SIZING_URL", 4003),
        },
        mfe_user_management: {
          type: "var",
          name: "mfe_user_management",
          entry: mfeEntry("VITE_MFE_USER_MANAGEMENT_URL", 4005),
        },
        mfe_super_admin: {
          type: "var",
          name: "mfe_super_admin",
          entry: mfeEntry("VITE_MFE_SUPER_ADMIN_URL", 4006),
        },
      },
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
      },
      runtimePlugins: ["./src/mfe-resilience-plugin.ts"],
    }),
    mfeBootstrapResilientPlugin(),
  ],
  server: {
    port: 3001,
    proxy: {
      "/api": apiBaseUrl,
    },
  },
  preview: {
    port: 8080,
    host: true,
    proxy: {
      "/api": apiBaseUrl,
    },
  },
});
