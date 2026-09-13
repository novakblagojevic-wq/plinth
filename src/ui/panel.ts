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
  ['w', 'Širina', 20, 600, 1, 1000, 'mm'], ['h', 'Visina', 20, 600, 1, 1000, 'mm'],
  ['depth', 'Debljina', 1, 50, .1, 1000, 'mm'], ['cornerRadius', 'Zaobljenje', .2, 100, .1, 1000, 'mm'],
  ['bezel', 'Okvir ekrana', .1, 50, .1, 1000, 'mm'], ['screenInset', 'Udubljenje ekrana', 0, 10, .1, 1000, 'mm'],
  ['frameMetalness', 'Metalnost', 0, 1, .01, 1, ''], ['frameRoughness', 'Hrapavost', 0, 1, .01, 1, ''],
  ['glassClearcoat', 'Sjaj stakla', 0, 1, .01, 1, ''],
] as const;
const names: Record<string, string> = { phone: 'Telefon', tablet: 'Tablet', laptop: 'Laptop', browser: 'Prozor', card: 'Kartica',
  front: 'Spreda', hero: 'Tri četvrtine', top: 'Odozgo', lean: 'Naslonjeno', custom: 'Prilagođeno',
  'soft-studio': 'Meko svetlo', 'dark-glass': 'Tamni studio', 'warm-sunset': 'Toplo svetlo', 'clean-white': 'Čisto belo',
  contain: 'Cela slika', cover: 'Popuni ekran', preset: 'Boja scene', solid: 'Jedna boja', gradient: 'Preliv', transparent: 'Providna',
  none: 'Bez postolja', plate: 'Ploča', hinge: 'Šarka', agx: 'AgX', aces: 'ACES' };
/** Validate user edits only; displaying a saved value never quantizes it. */
export function validNumericEdit(value: number, min: number, max: number, step: number): boolean {
  const steps = (value - min) / step;
  return Number.isFinite(value) && value >= min && value <= max
    && Math.abs(steps - Math.round(steps)) < 1e-7;
}
export function deviceEditError(spec: DeviceSpec): string | undefined {
  const messages: Record<string, string> = {
    'screenInset < bezel': 'Udubljenje ekrana mora biti manje od okvira ekrana.',
    'bezel < cornerRadius': 'Okvir ekrana mora biti manji od zaobljenja.',
    'cornerRadius <= min(w,h)/2': 'Zaobljenje ne sme biti veće od polovine širine ili visine.',
    'screenInset < depth': 'Udubljenje ekrana mora biti manje od debljine uređaja.',
  };
  const violation = invariantViolations(spec)[0];
  return violation ? messages[violation] ?? 'Proveri dimenzije uređaja.' : undefined;
}
export function createPanel(root: HTMLElement, store: SettingsStore, layoutChanged: () => void, exporter?: DownloadController) {
  const abort = new AbortController(); const signal = abort.signal;
  const refreshers: ((state: Settings) => void)[] = [];
  root.innerHTML = '<header><div><span class="eyebrow">PLINTH</span><h1>Studio za tvoju sliku</h1></div><button type="button" id="sheet-close" aria-label="Zatvori podešavanja">×</button></header>';
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
      errors.set(control, e instanceof Error ? e.message : 'Promena nije primenjena.');
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
      if (!validNumericEdit(value, min, max, step)) throw new Error(`${title}: ${min}–${max} ${suffix}, korak ${step}.`);
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
  const image = section('Tvoja slika');
  const pick = document.querySelector<HTMLButtonElement>('#pick')!; pick.textContent = 'Izaberi sliku'; image.append(pick, document.querySelector('#note')!);
  const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'PNG, JPG ili WebP · možeš i da prevučeš ili nalepiš sliku. Sve ostaje u ovoj kartici.'; image.append(hint);
  const looks = section('Gotovi izgledi'); const grid = document.createElement('div'); grid.className = 'looks'; looks.append(grid);
  for (const row of COMPOSITIONS) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.composition = row.id;
    const img = document.createElement('img'); img.src = `compositions/${row.id}.png`; img.alt = ''; img.width = 240; img.height = 150;
    const caption = document.createElement('span'); caption.textContent = row.name; button.append(img, caption);
    button.addEventListener('click', () => attempt(button, () => store.compose(row.id)), { signal }); grid.append(button);
    refreshers.push(state => button.setAttribute('aria-pressed', String(state.composition === row.id)));
  }
  const view = section('Uređaj i kadar');
  select(view, 'device', 'Uređaj', DEVICE_IDS, s => s.device, value => store.setDevice(value as Settings['device']));
  select(view, 'pose', 'Ugao', [...POSE_IDS, 'custom'], s => s.pose ?? 'custom', value => store.apply({ pose: value as Settings['pose'] }));
  select(view, 'aspect', 'Format', ASPECT_IDS, s => s.aspect, value => store.apply({ aspect: value as Settings['aspect'] }));
  numeric(view, 'outputPad', 'Prostor oko uređaja', 0, 25, 1, s => s.outputPad * 100, value => store.apply({ outputPad: value / 100 }));
  const light = section('Svetlo i pozadina');
  select(light, 'scene', 'Svetlo', SCENE_IDS, s => s.scene, value => store.apply({ scene: value as Settings['scene'] }));
  select(light, 'background', 'Pozadina', ['preset', 'solid', 'gradient', 'transparent'], s => s.background.mode, value => store.apply({ background: { ...store.get().background, mode: value as Settings['background']['mode'] } }));
  const solid = document.createElement('div'); light.append(solid);
  colour(solid, 'solid', 'Boja pozadine', s => s.background.solid, value => store.apply({ background: { ...store.get().background, solid: value } }));
  const gradient = document.createElement('div'); light.append(gradient);
  for (const [key, title] of [['top', 'Gornja boja'], ['bottom', 'Donja boja']] as const) colour(gradient, key, title, s => s.background[key], value => store.apply({ background: { ...store.get().background, [key]: value } }));
  refreshers.push(state => { solid.hidden = state.background.mode !== 'solid'; gradient.hidden = state.background.mode !== 'gradient'; });
  function applySpec(patch: Partial<DeviceSpec>): void {
    const spec = { ...store.get().spec, ...patch };
    const error = deviceEditError(spec); if (error) throw new Error(error);
    store.apply({ spec });
  }
  const fit = section('Slika na ekranu');
  select(fit, 'fit', 'Uklapanje', ['contain', 'cover'], s => s.fit, value => store.apply({ fit: value as Settings['fit'] }));
  numeric(fit, 'pad', 'Margina slike', 0, 25, 1, s => s.pad * 100, value => store.apply({ pad: value / 100 }));
  colour(fit, 'padColor', 'Boja margine', s => s.padColor, value => store.apply({ padColor: value }));
  const png = exporter ? section('Sačuvaj sliku') : undefined;
  let refreshExport = (): void => {};
  let recovery: RecoveryState = 'ready';
  let exportUnsubscribe = (): void => {};
  if (png && exporter) {
    label(png, 'Veličina PNG slike', 'png-scale');
    const scale = document.createElement('select'); scale.id = 'png-scale';
    for (const n of [1,2,3]) { const option = document.createElement('option'); option.value = String(n); scale.append(option); }
    const button = document.createElement('button'); button.id = 'png-export'; button.type = 'button'; button.textContent = 'Izvezi PNG';
    const status = document.createElement('p'); status.id = 'png-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const link = document.createElement('a'); link.id = 'png-download'; link.textContent = 'Preuzmi PNG'; link.hidden = true;
    const reload = document.createElement('button'); reload.id = 'png-reload'; reload.type = 'button'; reload.textContent = 'Ponovo učitaj'; reload.hidden = true;
    reload.addEventListener('click', () => window.location.reload(), { signal });
    button.addEventListener('click', () => { void exporter.run(Number(scale.value) as ExportScale).catch(() => {}); }, { signal });
    link.addEventListener('click', () => { status.textContent = 'Preuzimanje je pokrenuto. Proveri preuzete fajlove.'; }, { signal });
    png.append(scale, button, status, link, reload);
    function display(value: DownloadState): void {
      button.disabled = value.busy || recovery !== 'ready'; scale.disabled = value.busy || recovery !== 'ready';
      button.setAttribute('aria-busy', String(value.busy));
      status.textContent = recovery === 'ready' ? value.message : recovery === 'failed' || recovery === 'lost'
        ? 'Obnavljanje prikaza. Ako se prikaz ne vrati, ponovo učitaj stranicu i izaberi sliku.' : 'Obnavljanje prikaza…';
      reload.hidden = !['lost', 'failed'].includes(recovery);
      link.hidden = !value.result || recovery !== 'ready';
      if (value.result && recovery === 'ready') { link.href = value.result.url; link.download = value.result.filename; link.textContent = `Preuzmi PNG · ${value.result.width} × ${value.result.height}`; }
      else { link.removeAttribute('href'); link.removeAttribute('download'); }
    }
    refreshExport = () => display(exporter.get());
    exportUnsubscribe = exporter.subscribe(display);
    refreshers.push(state => { for (const option of scale.options) { const n = Number(option.value) as ExportScale; const d = outputDimensions(state.aspect, n); option.textContent = `${n}× · ${d.width} × ${d.height}`; } });
    refreshExport();
  }
  const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Napredna podešavanja'; summary.setAttribute('aria-controls', 'advanced-controls'); summary.setAttribute('aria-expanded', 'false'); details.append(summary); root.append(details);
  const advanced = section('Oblik i materijal', details); advanced.id = 'advanced-controls';
  details.addEventListener('toggle', () => summary.setAttribute('aria-expanded', String(details.open)), { signal });
  for (const [key, title, min, max, step, scale, unit] of ADVANCED_FIELDS) numeric(advanced, key, title, min, max, step, s => s.spec[key] * scale, value => applySpec({ [key]: value / scale }), 'number', unit);
  select(advanced, 'standType', 'Postolje', ['none', 'plate', 'hinge'], s => s.spec.standType, value => applySpec({ standType: value as DeviceSpec['standType'] }));
  const hinge = numeric(advanced, 'hingeAngle', 'Ugao šarke', 60, 150, 1, s => s.spec.hingeAngle * 180 / Math.PI, value => applySpec({ hingeAngle: value * Math.PI / 180 }), 'range', '°');
  refreshers.push(state => { hinge.disabled = state.spec.standType !== 'hinge'; });
  select(advanced, 'tone', 'Obrada svetla', ['agx', 'aces'], s => s.tone, value => store.apply({ tone: value as Settings['tone'] }));
  const msaaLabel = label(advanced, 'MSAA zaglađivanje prikaza', 'control-msaa'); const msaa = document.createElement('input'); msaa.id = 'control-msaa'; msaa.type = 'checkbox'; msaaLabel.prepend(msaa);
  msaa.addEventListener('change', () => attempt(msaa, () => store.apply({ msaa: msaa.checked })), { signal }); refreshers.push(s => { msaa.checked = s.msaa; });
  const reset = document.createElement('button'); reset.type = 'button'; reset.id = 'reset'; reset.textContent = 'Vrati početni izgled'; reset.addEventListener('click', () => attempt(reset, () => store.reset()), { signal }); root.append(reset, error);
  const refresh = (state: Settings, reason?: string): void => {
    // A complete composition replaces pending edits, including through the QA API.
    // Unrelated successful edits leave other invalid controls and their messages intact.
    if (reason === 'apply' && state.composition !== null) clearError();
    for (const fn of refreshers) fn(state);
  };
  refresh(store.get()); const unsubscribe = store.subscribe(refresh);
  function setOpen(open: boolean): void {
    document.body.classList.toggle('sheet-open', open); opener.setAttribute('aria-expanded', String(open));
    layoutChanged(); (open ? close : opener).focus();
  }
  opener.addEventListener('click', () => setOpen(!document.body.classList.contains('sheet-open')), { signal });
  close.addEventListener('click', () => setOpen(false), { signal });
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && matchMedia('(max-width: 899px)').matches) { event.preventDefault(); setOpen(false); } }, { signal });
  root.addEventListener('focusin', event => { (event.target as HTMLElement).scrollIntoView({ block: 'nearest' }); }, { signal });
  return { setOpen,
    setRecovery(value: RecoveryState) {
      recovery = value;
      for (const element of root.children) if (element instanceof HTMLElement && element !== png && element.tagName !== 'HEADER') element.inert = value !== 'ready';
      refreshExport();
    },
    dispose() { exportUnsubscribe(); unsubscribe(); abort.abort(); }
  };
}
