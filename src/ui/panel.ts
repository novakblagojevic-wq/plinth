import type { ShareMessage } from '../state/share';
import { DEVICE_IDS } from '../devices/presets';
import { invariantViolations, type DeviceSpec } from '../devices/spec';
import { POSE_IDS } from '../camera/poses';
import { ASPECT_IDS, outputDimensions } from '../output';
import type { DownloadController, DownloadState } from '../export/download';
import type { ExportScale } from '../export/preflight';
import type { RecoveryState } from '../export/recovery';
import { SCENE_IDS } from '../scene/presets';
import type { Settings, SettingsStore } from '../settings';
import { COMPOSITIONS } from './compositions';

export const ADVANCED_FIELDS = [
  ['w', 'Width', 20, 600, 1, 1000, 'mm'], ['h', 'Height', 20, 600, 1, 1000, 'mm'],
  ['depth', 'Depth', 1, 50, .1, 1000, 'mm'], ['cornerRadius', 'Corner radius', .2, 100, .1, 1000, 'mm'],
  ['bezel', 'Screen bezel', .1, 50, .1, 1000, 'mm'], ['screenInset', 'Screen inset', 0, 10, .1, 1000, 'mm'],
  ['frameMetalness', 'Metalness', 0, 1, .01, 1, ''], ['frameRoughness', 'Roughness', 0, 1, .01, 1, ''],
  ['glassClearcoat', 'Glass gloss', 0, 1, .01, 1, ''],
] as const;
const names: Record<string, string> = { phone: 'Phone', tablet: 'Tablet', laptop: 'Laptop', browser: 'Browser', card: 'Card',
  front: 'Front', hero: 'Three-quarter', top: 'Top', lean: 'Lean', custom: 'Custom',
  'soft-studio': 'Soft studio', 'dark-glass': 'Dark studio', 'warm-sunset': 'Warm sunset', 'clean-white': 'Clean white',
  contain: 'Fit image', cover: 'Fill screen', preset: 'Scene color', solid: 'Solid color', gradient: 'Gradient', transparent: 'Transparent',
  none: 'None', plate: 'Plate', hinge: 'Hinge', agx: 'AgX', aces: 'ACES' };
/** Validate user edits only; displaying a saved value never quantizes it. */
export function validNumericEdit(value: number, min: number, max: number, step: number): boolean {
  const steps = (value - min) / step;
  return Number.isFinite(value) && value >= min && value <= max
    && Math.abs(steps - Math.round(steps)) < 1e-7;
}
export function deviceEditError(spec: DeviceSpec): string | undefined {
  const messages: Record<string, string> = {
    'screenInset < bezel': 'Screen inset must be smaller than the bezel.',
    'bezel < cornerRadius': 'Screen bezel must be smaller than the corner radius.',
    'cornerRadius <= min(w,h)/2': 'Corner radius must not exceed half the width or height.',
    'screenInset < depth': 'Screen inset must be smaller than the device depth.',
  };
  const violation = invariantViolations(spec)[0];
  return violation ? messages[violation] ?? 'Check the device dimensions.' : undefined;
}
export function createPanel(root: HTMLElement, store: SettingsStore, layoutChanged: () => void, exporter?: DownloadController, share?: () => void) {
  const abort = new AbortController(); const signal = abort.signal;
  const refreshers: ((state: Settings) => void)[] = [];
  root.innerHTML = '<header><div><span class="eyebrow">PLINTH</span><h1>A studio for your screenshot</h1></div><button type="button" id="sheet-close" aria-label="Close settings">×</button></header>';
  const close = root.querySelector<HTMLButtonElement>('#sheet-close')!;
  const opener = document.querySelector<HTMLButtonElement>('#settings-open')!;
  const error = document.createElement('p'); error.id = 'settings-error'; error.setAttribute('role', 'status'); error.setAttribute('aria-live', 'polite');
  const errors = new Map<HTMLElement, string>();
  function clearError(control?: HTMLElement): void {
    for (const field of control ? [control] : [...errors.keys()]) {
      errors.delete(field); field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby');
    }
    error.textContent = [...errors.values()].join(' ');
  }
  function attempt(control: HTMLElement, action: () => void): void {
    try { action(); clearError(control); refresh(store.get()); }
    catch (e) {
      errors.set(control, e instanceof Error ? e.message : 'The change could not be applied.');
      error.textContent = [...errors.values()].join(' '); control.insertAdjacentElement('afterend', error);
      control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', error.id);
    }
  }
  function section(title: string, parent = root): HTMLElement {
    const element = document.createElement('section'); const h = document.createElement('h2'); h.textContent = title; element.append(h); parent.append(element); return element;
  }
  function label(parent: HTMLElement, text: string, id: string): HTMLLabelElement {
    const element = document.createElement('label'); element.htmlFor = id; element.textContent = text; parent.append(element); return element;
  }
  function select(parent: HTMLElement, key: string, title: string, values: readonly string[], read: (state: Settings) => string, write: (value: string) => void) {
    const id = `control-${key}`; label(parent, title, id);
    const input = document.createElement('select'); input.id = id;
    for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = names[value] ?? value; if (value === 'custom') option.disabled = true; input.append(option); }
    input.addEventListener('change', () => attempt(input, () => write(input.value)), { signal });
    parent.append(input); refreshers.push(state => { input.value = read(state); }); return input;
  }
  function numeric(parent: HTMLElement, key: string, title: string, min: number, max: number, step: number, read: (state: Settings) => number, write: (value: number) => void, type = 'range', suffix = '%') {
    const id = `control-${key}`; const l = label(parent, title, id); const output = document.createElement('output'); output.htmlFor = id; l.append(output);
    const input = document.createElement('input'); input.type = type; input.id = id; input.min = String(min); input.max = String(max); input.step = String(step);
    input.addEventListener('input', () => attempt(input, () => {
      const value = input.valueAsNumber;
      if (!validNumericEdit(value, min, max, step)) throw new Error(`${title}: ${min}–${max} ${suffix}, step ${step}.`);
      write(value);
    }), { signal });
    input.addEventListener('keydown', event => { if (event.key === 'Escape' && input.hasAttribute('aria-invalid')) { event.stopPropagation(); input.value = String(read(store.get())); clearError(input); } }, { signal });
    refreshers.push(state => { const value = read(state); if (!input.hasAttribute('aria-invalid')) input.value = String(value); output.value = `${Math.round(value * 100) / 100}${suffix}`; });
    parent.append(input); return input;
  }
  function colour(parent: HTMLElement, key: string, title: string, read: (state: Settings) => string, write: (value: string) => void) {
    const id = `control-${key}`; label(parent, title, id); const input = document.createElement('input'); input.id = id; input.type = 'color';
    input.addEventListener('input', () => attempt(input, () => write(input.value)), { signal });
    refreshers.push(state => { input.value = read(state); }); parent.append(input); return input;
  }
  const image = section('Your image');
  const pick = document.querySelector<HTMLButtonElement>('#pick')!; pick.textContent = 'Choose image'; image.append(pick, document.querySelector('#note')!);
  const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'PNG, JPG or WebP · Drop or paste an image. Everything stays in this tab.'; image.append(hint);
  const looks = section('Ready-made looks'); const grid = document.createElement('div'); grid.className = 'looks'; looks.append(grid);
  for (const row of COMPOSITIONS) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.composition = row.id;
    const img = document.createElement('img'); img.src = `compositions/${row.id}.png`; img.alt = ''; img.width = 240; img.height = 150;
    const caption = document.createElement('span'); caption.textContent = row.name; button.append(img, caption);
    button.addEventListener('click', () => attempt(button, () => store.compose(row.id)), { signal }); grid.append(button);
    refreshers.push(state => button.setAttribute('aria-pressed', String(state.composition === row.id)));
  }
  const view = section('Device and framing');
  select(view, 'device', 'Device', DEVICE_IDS, s => s.device, value => store.setDevice(value as Settings['device']));
  select(view, 'pose', 'Angle', [...POSE_IDS, 'custom'], s => s.pose ?? 'custom', value => store.apply({ pose: value as Settings['pose'] }));
  select(view, 'aspect', 'Aspect ratio', ASPECT_IDS, s => s.aspect, value => store.apply({ aspect: value as Settings['aspect'] }));
  numeric(view, 'outputPad', 'Space around device', 0, 25, 1, s => s.outputPad * 100, value => store.apply({ outputPad: value / 100 }));
  const light = section('Lighting and background');
  select(light, 'scene', 'Lighting', SCENE_IDS, s => s.scene, value => store.apply({ scene: value as Settings['scene'] }));
  select(light, 'background', 'Background', ['preset', 'solid', 'gradient', 'transparent'], s => s.background.mode, value => store.apply({ background: { ...store.get().background, mode: value as Settings['background']['mode'] } }));
  const solid = document.createElement('div'); light.append(solid);
  colour(solid, 'solid', 'Background color', s => s.background.solid, value => store.apply({ background: { ...store.get().background, solid: value } }));
  const gradient = document.createElement('div'); light.append(gradient);
  for (const [key, title] of [['top', 'Top color'], ['bottom', 'Bottom color']] as const) colour(gradient, key, title, s => s.background[key], value => store.apply({ background: { ...store.get().background, [key]: value } }));
  refreshers.push(state => { solid.hidden = state.background.mode !== 'solid'; gradient.hidden = state.background.mode !== 'gradient'; });
  function applySpec(patch: Partial<DeviceSpec>): void {
    const spec = { ...store.get().spec, ...patch };
    const error = deviceEditError(spec); if (error) throw new Error(error);
    store.apply({ spec });
  }
  const fit = section('Screen image');
  select(fit, 'fit', 'Image fit', ['contain', 'cover'], s => s.fit, value => store.apply({ fit: value as Settings['fit'] }));
  numeric(fit, 'pad', 'Image padding', 0, 25, 1, s => s.pad * 100, value => store.apply({ pad: value / 100 }));
  colour(fit, 'padColor', 'Padding color', s => s.padColor, value => store.apply({ padColor: value }));
  const png = exporter ? section('Save image') : undefined;
  let refreshExport = (): void => {};
  let recovery: RecoveryState = 'ready';
  let exportUnsubscribe = (): void => {};
  if (png && exporter) {
    label(png, 'PNG size', 'png-scale');
    const scale = document.createElement('select'); scale.id = 'png-scale';
    for (const n of [1,2,3]) { const option = document.createElement('option'); option.value = String(n); scale.append(option); }
    const button = document.createElement('button'); button.id = 'png-export'; button.type = 'button'; button.textContent = 'Export PNG';
    const status = document.createElement('p'); status.id = 'png-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const link = document.createElement('a'); link.id = 'png-download'; link.textContent = 'Download PNG'; link.hidden = true;
    const reload = document.createElement('button'); reload.id = 'png-reload'; reload.type = 'button'; reload.textContent = 'Reload page'; reload.hidden = true;
    reload.addEventListener('click', () => window.location.reload(), { signal });
    scale.addEventListener('change', () => attempt(scale, () => store.apply({pngScale:Number(scale.value) as ExportScale})), {signal});
    button.addEventListener('click', () => { if (recovery === 'ready') void exporter.run(store.get().pngScale).catch(() => {}); }, { signal });
    link.addEventListener('click', () => { status.textContent = 'Download started. Check your downloads.'; }, { signal });
    png.append(scale, button, status, link, reload);
    function display(value: DownloadState): void {
      button.disabled = value.busy || recovery !== 'ready'; scale.disabled = value.busy || recovery !== 'ready';
      button.setAttribute('aria-busy', String(value.busy));
      status.textContent = recovery === 'ready' ? value.message : recovery === 'failed' || recovery === 'lost'
        ? 'Restoring the preview. If it does not return, reload the page and choose your image again.' : 'Restoring the preview…';
      reload.hidden = !['lost', 'failed'].includes(recovery);
      link.hidden = !value.result || recovery !== 'ready';
      if (value.result && recovery === 'ready') { link.href = value.result.url; link.download = value.result.filename; link.textContent = `Download PNG · ${value.result.width} × ${value.result.height}`; }
      else { link.removeAttribute('href'); link.removeAttribute('download'); }
    }
    refreshExport = () => display(exporter.get());
    exportUnsubscribe = exporter.subscribe(display);
    refreshers.push(state => { scale.value = String(state.pngScale); for (const option of scale.options) { const n = Number(option.value) as ExportScale; const d = outputDimensions(state.aspect, n); option.textContent = `${n}× · ${d.width} × ${d.height}`; } });
    refreshExport();
  }
  let showShare = (_value: ShareMessage): void => {};
  if (share) {
    const area = section('Share scene'); area.id = 'share-section';
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Links include the scene settings, never your image.';
    const button = document.createElement('button'); button.type = 'button'; button.id = 'copy-link'; button.textContent = 'Copy link';
    button.addEventListener('click', share, {signal});
    const status = document.createElement('p'); status.id = 'share-status'; status.setAttribute('role','status');
    const fallback = document.createElement('input'); fallback.id = 'share-url'; fallback.readOnly = true; fallback.hidden = true; fallback.setAttribute('aria-label','Scene link to copy manually');
    fallback.addEventListener('focus', () => fallback.select(), {signal});
    fallback.addEventListener('click', () => fallback.select(), {signal});
    area.append(hint,button,status,fallback);
    showShare = value => { if (value.message && matchMedia('(max-width: 899px)').matches && !document.body.classList.contains('sheet-open')) setOpen(true); status.textContent = value.message; fallback.hidden = !value.url; fallback.value = value.url ?? ''; if (value.url) { setOpen(true); fallback.focus(); fallback.select(); } };
    const help = section('Keyboard shortcuts');
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'shortcut-help'; toggle.textContent = 'Show keyboard shortcuts'; toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-controls','shortcut-keys');
    const content = document.createElement('p'); content.id = 'shortcut-keys'; content.hidden = true;
    content.textContent = '1–5: Phone, Tablet, Laptop, Browser, Card. Q/W/E/R: Front, Three-quarter, Top, Lean. Shift+E: Prepare PNG at the selected size, then choose Download PNG. Shortcuts stay inactive while typing.';
    toggle.addEventListener('click', () => { content.hidden = !content.hidden; toggle.setAttribute('aria-expanded',String(!content.hidden)); }, {signal});
    help.append(toggle,content);
  }
  const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Advanced settings'; summary.setAttribute('aria-controls', 'advanced-controls'); summary.setAttribute('aria-expanded', 'false'); details.append(summary); root.append(details);
  const advanced = section('Shape and material', details); advanced.id = 'advanced-controls';
  details.addEventListener('toggle', () => summary.setAttribute('aria-expanded', String(details.open)), { signal });
  for (const [key, title, min, max, step, scale, unit] of ADVANCED_FIELDS) numeric(advanced, key, title, min, max, step, s => s.spec[key] * scale, value => applySpec({ [key]: value / scale }), 'number', unit);
  select(advanced, 'standType', 'Stand', ['none', 'plate', 'hinge'], s => s.spec.standType, value => applySpec({ standType: value as DeviceSpec['standType'] }));
  const hinge = numeric(advanced, 'hingeAngle', 'Hinge angle', 60, 150, 1, s => s.spec.hingeAngle * 180 / Math.PI, value => applySpec({ hingeAngle: value * Math.PI / 180 }), 'range', '°');
  refreshers.push(state => { hinge.disabled = state.spec.standType !== 'hinge'; });
  select(advanced, 'tone', 'Tone mapping', ['agx', 'aces'], s => s.tone, value => store.apply({ tone: value as Settings['tone'] }));
  const msaaLabel = label(advanced, 'MSAA preview smoothing', 'control-msaa'); const msaa = document.createElement('input'); msaa.id = 'control-msaa'; msaa.type = 'checkbox'; msaaLabel.prepend(msaa);
  msaa.addEventListener('change', () => attempt(msaa, () => store.apply({ msaa: msaa.checked })), { signal }); refreshers.push(s => { msaa.checked = s.msaa; });
  const reset = document.createElement('button'); reset.type = 'button'; reset.id = 'reset'; reset.textContent = 'Reset look'; reset.addEventListener('click', () => attempt(reset, () => store.reset()), { signal }); root.append(reset, error);
  const refresh = (state: Settings, reason?: string): void => {
    // A complete composition replaces pending edits, including through the QA API.
    // Unrelated successful edits leave other invalid controls and their messages intact.
    if (reason === 'compose' || (reason === 'apply' && state.composition !== null)) clearError();
    for (const fn of refreshers) fn(state);
  };
  refresh(store.get()); const unsubscribe = store.subscribe(refresh);
  function setOpen(open: boolean): void {
    document.body.classList.toggle('sheet-open', open); opener.setAttribute('aria-expanded', String(open));
    layoutChanged(); (matchMedia('(max-width: 899px)').matches ? (open ? close : opener) : pick).focus();
  }
  opener.addEventListener('click', () => setOpen(!document.body.classList.contains('sheet-open')), { signal });
  close.addEventListener('click', () => setOpen(false), { signal });
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && matchMedia('(max-width: 899px)').matches) { event.preventDefault(); setOpen(false); } }, { signal });
  root.addEventListener('focusin', event => { (event.target as HTMLElement).scrollIntoView({ block: 'nearest' }); }, { signal });
  const media = matchMedia('(max-width: 899px)');
  let lastFocused: Element | null = document.activeElement;
  document.addEventListener('focusin', event => { if (event.target instanceof Element && event.target !== document.body) lastFocused = event.target; }, {signal});
  const adjustFocus = (): void => {
    const active = document.activeElement === document.body ? lastFocused : document.activeElement;
    if (!media.matches && (active === close || active === opener)) pick.focus();
    else if (media.matches && !document.body.classList.contains('sheet-open') && root.contains(active)) opener.focus();
  };
  media.addEventListener('change',adjustFocus,{signal});
  return { setOpen, showShare,
    setRecovery(value: RecoveryState) {
      recovery = value;
      for (const element of root.children) if (element instanceof HTMLElement && element !== png && element.tagName !== 'HEADER') element.inert = value !== 'ready';
      refreshExport();
    },
    dispose() { exportUnsubscribe(); unsubscribe(); abort.abort(); }
  };
}
