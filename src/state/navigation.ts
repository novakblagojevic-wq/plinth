/** Browser history ownership; replaceState never feeds back as an input event. */
export function createNavigation(options: {
  target: Window; snapshot(): string; apply(hash: string): void;
  available(): boolean; notice(message: string): void; invalidate(): void;
}) {
  const win = options.target;
  let disposed = false, applying = false, pending: string | undefined;
  let last = win.location.hash;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = (): void => { clearTimeout(timer); timer = undefined; };
  function restore(hash: string): void {
    cancel(); options.invalidate();
    if (!options.available()) { pending = hash; return; }
    pending = undefined; applying = true;
    try { options.apply(hash); }
    catch (error) { options.notice(error instanceof Error ? error.message : 'Unable to load scene link.'); }
    finally { applying = false; }
  }
  function navigate(): void {
    if (disposed || win.location.hash === last) return;
    last = win.location.hash; restore(last);
  }
  function write(hash: string): void {
    if (disposed) return;
    try {
      const next = win.location.pathname + hash;
      if (win.location.hash !== hash || win.location.search) win.history.replaceState(null,'',next);
      last = hash;
    } catch { options.notice('The address could not be updated. You can still use Copy link.'); }
  }
  win.addEventListener('hashchange',navigate); win.addEventListener('popstate',navigate);
  return {
    initial() { if (last) restore(last); },
    changed() {
      if (disposed || applying || !options.available()) return;
      cancel(); options.invalidate();
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed || !options.available()) return;
        try { write(options.snapshot()); } catch (error) { options.notice(error instanceof Error ? error.message : 'Unable to share this scene.'); }
      },250);
    },
    copied(hash: string) { cancel(); write(hash); },
    ready() { if (!disposed && pending !== undefined && options.available()) restore(pending); },
    suspend() { cancel(); },
    dispose() { disposed = true; cancel(); pending = undefined; win.removeEventListener('hashchange',navigate); win.removeEventListener('popstate',navigate); },
  };
}
