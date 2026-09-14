import type { DeviceId } from '../devices/presets';
import type { PoseId } from '../camera/poses';
export function attachShortcuts(target: Window, actions: {
  ready(): boolean; device(id: DeviceId): void; pose(id: PoseId): void; png(): boolean; error(error: unknown): void;
}) {
  const handler = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || !actions.ready()) return;
    if (event.composedPath().some(node => {
      const element = node as HTMLElement;
      return ['INPUT','TEXTAREA','SELECT'].includes(element.tagName) || element.isContentEditable || element.closest?.('[contenteditable]:not([contenteditable="false"])');
    })) return;
    const key = event.key.toLowerCase();
    try {
      if (event.shiftKey) { if (key === 'e' && actions.png()) event.preventDefault(); return; }
      const devices: Record<string,DeviceId> = {'1':'phone','2':'tablet','3':'laptop','4':'browser','5':'card'};
      const poses: Record<string,PoseId> = {q:'front',w:'hero',e:'top',r:'lean'};
      if (Object.hasOwn(devices,key)) { actions.device(devices[key]!); event.preventDefault(); }
      else if (Object.hasOwn(poses,key)) { actions.pose(poses[key]!); event.preventDefault(); }
    } catch (error) { actions.error(error); }
  };
  target.addEventListener('keydown',handler);
  return () => target.removeEventListener('keydown',handler);
}
