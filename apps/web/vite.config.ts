import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

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
function mfeBootstrapResilientPlugin(): Plugin {
  return {
    name: "mfe-bootstrap-resilient",
    enforce: "post",
    transform(code: string) {
      if (!code.includes("__mfRemotePreloads")) return null;

      let patched = code
        // Fix 1: silence individual loadRemote failures
        .replace(/await Promise\.all\(__mfRemotePreloads\)/g, "await Promise.allSettled(__mfRemotePreloads)")
        // Fix 2: absorb any remaining bootstrap rejection before .then(entrySrc)
        .replace(
          /\}\)\(\)\.then\(/g,
          '})().catch(function(e){console.warn("[MFE] Bootstrap error suppressed:",String(e&&e.message||e).split("\\n")[0]);}).then(',
        );

      if (patched === code) return null;
      return { code: patched, map: null };
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
          entry: "http://192.168.1.8:4001/remoteEntry.js",
        },
        mfe_position_sizing: {
          type: "var",
          name: "mfe_position_sizing",
          entry: "http://192.168.1.8:4003/remoteEntry.js",
        },
        mfe_user_management: {
          type: "var",
          name: "mfe_user_management",
          entry: "http://192.168.1.8:4005/remoteEntry.js",
        },
        mfe_super_admin: {
          type: "var",
          name: "mfe_super_admin",
          entry: "http://192.168.1.8:4006/remoteEntry.js",
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
      "/api": "http://192.168.1.8:3000",
    },
  },
  preview: {
    port: 8080,
    host: true,
    proxy: {
      "/api": "http://192.168.1.8:3000",
    },
  },
});
