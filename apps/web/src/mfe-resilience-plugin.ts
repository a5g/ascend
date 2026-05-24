// Federation runtime plugin that makes remote MFEs optional.
//
// Root cause: the MF virtual bootstrap calls
//   await Promise.all(initRes.initializeSharing(...))
// where each element is a per-remote init promise. If any remote is unreachable
// (RUNTIME-008) the whole Promise.all rejects and the app fails to mount.
//
// Fix: in the `apply` hook (called synchronously after the federation instance
// is created, before initializeSharing runs) we patch initializeSharing so
// every per-remote promise swallows its own rejection. Promise.all then always
// resolves, and the app mounts even when some MFE servers are offline.
export default () => ({
  name: 'mfe-resilience-plugin',

  apply(instance: any) {
    if (typeof instance?.initializeSharing !== 'function') return;

    const original: (...args: any[]) => Array<Promise<void>> =
      instance.initializeSharing.bind(instance);

    instance.initializeSharing = (...args: any[]): Array<Promise<void>> => {
      const promises = original(...args);
      if (!Array.isArray(promises)) return promises;
      return promises.map(p =>
        Promise.resolve(p).catch((err: any) => {
          // One-line summary so the console stays readable.
          const msg = String(err?.message ?? err).split('\n')[0];
          console.warn('[MFE] Remote init skipped (server offline?):', msg);
        })
      );
    };
  },
});
