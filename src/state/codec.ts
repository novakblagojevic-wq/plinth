import type { DeviceId } from '../devices/presets';
import { invariantViolations, type DeviceSpec } from '../devices/spec';
import type { PoseId } from '../camera/poses';
import type { Settings } from '../settings';

export type SharedView = { pose: PoseId } | { pose: null; rotation: [number, number, number, number]; direction: [number, number, number] };
export interface SharedState {
  v: 1; device: DeviceId; spec: DeviceSpec; view: SharedView;
  scene: Settings['scene']; tone: Settings['tone']; msaa: boolean;
  aspect: Settings['aspect']; outputPad: number; background: Settings['background'];
  fit: Settings['fit']; pad: number; padColor: string; pngScale: 1 | 2 | 3;
}
function invalid(): never { throw new Error('Invalid scene link. Your current scene has not been changed.'); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) return invalid();
  return row;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return invalid();
  return value as T;
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return invalid();
  return value;
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return invalid();
  return value.toLowerCase();
}
function vector(value: unknown, length: number): number[] {
  if (!Array.isArray(value) || value.length !== length || Object.keys(value).length !== length || value.some(v => typeof v !== 'number' || !Number.isFinite(v))) return invalid();
  if (Math.abs(Math.hypot(...value) - 1) > 1e-6) return invalid();
  return [...value] as number[];
}
/** Standalone v1 validator: no rendering resources or Three instances are allocated. */
export function decodeV1(value: unknown): SharedState {
  const row = object(value, ['v','device','spec','view','scene','tone','msaa','aspect','outputPad','background','fit','pad','padColor','pngScale']);
  if (row.v !== 1) return invalid();
  const s = object(row.spec, ['w','h','depth','cornerRadius','bezel','screenInset','frameMetalness','frameRoughness','glassClearcoat','standType','hingeAngle']);
  const spec: DeviceSpec = {
    w: number(s.w,.020,.600), h: number(s.h,.020,.600), depth: number(s.depth,.001,.050),
    cornerRadius: number(s.cornerRadius,.0002,.100), bezel: number(s.bezel,.0001,.050), screenInset: number(s.screenInset,0,.010),
    frameMetalness: number(s.frameMetalness,0,1), frameRoughness: number(s.frameRoughness,0,1), glassClearcoat: number(s.glassClearcoat,0,1),
    standType: choice(s.standType,['none','plate','hinge']), hingeAngle: number(s.hingeAngle,Math.PI/3,5*Math.PI/6),
  };
  if (invariantViolations(spec).length) return invalid();
  const rawView = row.view as Record<string, unknown> | null;
  let view: SharedView;
  if (rawView?.pose === null) {
    const v = object(rawView, ['pose','rotation','direction']);
    const rotation = vector(v.rotation,4) as [number,number,number,number];
    const direction = vector(v.direction,3) as [number,number,number];
    const azimuth = Math.atan2(direction[0],direction[2]);
    const elevation = Math.asin(Math.max(-1,Math.min(1,direction[1]/Math.hypot(...direction))));
    if (Math.abs(azimuth) > 75*Math.PI/180+1e-9 || elevation < 5*Math.PI/180-1e-9 || elevation > 85*Math.PI/180+1e-9) return invalid();
    view = { pose: null, rotation, direction };
  } else { const v = object(rawView,['pose']); view = { pose: choice<PoseId>(v.pose,['front','hero','top','lean']) }; }
  const b = object(row.background,['mode','solid','top','bottom']);
  if (typeof row.msaa !== 'boolean' || ![1,2,3].includes(row.pngScale as number)) return invalid();
  return { v:1, device:choice(row.device,['phone','tablet','laptop','browser','card']), spec, view,
    scene:choice(row.scene,['soft-studio','dark-glass','warm-sunset','clean-white']), tone:choice(row.tone,['agx','aces']), msaa:row.msaa,
    aspect:choice(row.aspect,['1:1','4:5','16:9','9:16','3:1']), outputPad:number(row.outputPad,0,.25),
    background:{mode:choice(b.mode,['preset','solid','gradient','transparent']),solid:color(b.solid),top:color(b.top),bottom:color(b.bottom)},
    fit:choice(row.fit,['contain','cover']),pad:number(row.pad,0,.25),padColor:color(row.padColor),pngScale:row.pngScale as 1|2|3 };
}
function base64(text: string): string {
  return btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeHash(hash: string): SharedState {
  if (!hash.startsWith('#s=')) return invalid();
  const payload = hash.slice(3);
  if (payload.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return invalid();
  let value: unknown;
  try {
    const bytes = Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')), char => char.charCodeAt(0));
    const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if (base64(text) !== payload) return invalid();
    value = JSON.parse(text);
  } catch { return invalid(); }
  if (value && typeof value === 'object' && Object.hasOwn(value,'v') && typeof (value as {v:unknown}).v === 'number' && (value as {v:number}).v !== 1) {
    throw new Error('Unsupported scene link version. Your current scene has not been changed.');
  }
  return decodeV1(value);
}
/** Explicit projection prevents runtime extras (including image metadata) entering links. */
export function snapshotState(state: Settings, transitioning: boolean): SharedState {
  const s = state.spec;
  return decodeV1({v:1,device:state.device,spec:{w:s.w,h:s.h,depth:s.depth,cornerRadius:s.cornerRadius,bezel:s.bezel,screenInset:s.screenInset,
    frameMetalness:s.frameMetalness,frameRoughness:s.frameRoughness,glassClearcoat:s.glassClearcoat,standType:s.standType,hingeAngle:s.hingeAngle},
    view:state.pose !== null && !transitioning ? {pose:state.pose} : {pose:null,rotation:state.custom.rotation.toArray(),direction:state.custom.direction.toArray()},
    scene:state.scene,tone:state.tone,msaa:state.msaa,aspect:state.aspect,outputPad:state.outputPad,
    background:{mode:state.background.mode,solid:state.background.solid,top:state.background.top,bottom:state.background.bottom},
    fit:state.fit,pad:state.pad,padColor:state.padColor,pngScale:state.pngScale});
}
export function encodeHash(state: SharedState): string {
  const payload = base64(JSON.stringify(decodeV1(state)));
  if (payload.length > 8192) return invalid();
  return '#s='+payload;
}
