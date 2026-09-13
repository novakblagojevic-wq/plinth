export interface ShareMessage { message: string; url?: string }
/** A copy belongs to one exact click/navigation generation, including async denial. */
export function createShare(options: {
  snapshot(): string; location: Pick<Location,'origin'|'pathname'>;
  writeText?: (text: string) => Promise<void>; address(hash: string): void;
  show(value: ShareMessage): void;
}) {
  let generation = 0, disposed = false;
  return {
    invalidate() { ++generation; },
    async copy() {
      if (disposed) return;
      const current = ++generation;
      let url: string;
      try {
        const hash = options.snapshot();
        url = options.location.origin + options.location.pathname + hash;
        options.address(hash);
      } catch (error) { options.show({message:error instanceof Error ? error.message : 'Unable to share this scene.'}); return; }
      options.show({message:'Copying link…'});
      try {
        if (!options.writeText) throw new Error('Clipboard unavailable');
        await options.writeText(url);
        if (!disposed && current === generation) options.show({message:'Link copied'});
      } catch {
        if (!disposed && current === generation) options.show({message:'Copy this link manually',url});
      }
    },
    dispose() { disposed = true; ++generation; },
  };
}
