import { REVISION, type ShaderMaterial } from 'three';
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

/** Derived from Three.js 0.185.1 SMAABlendShader (MIT; see LICENSES.md).
 * Decode straight encoded RGB into coverage-weighted gamma light, interpolate,
 * encode, then associate with alpha again. Opaque behavior is unchanged.
 */
export function alphaBlendShader(source: string): string {
  if (REVISION !== '185') throw new Error('Alpha SMAA requires Three.js revision 185.');
  const changes = [
    ['C.xyz = pow(C.xyz, vec3(2.2));', 'C.xyz = pow(C.xyz / max(C.a, 1e-6), vec3(2.2)) * C.a;'],
    ['Cop.xyz = pow(Cop.xyz, vec3(2.2));', 'Cop.xyz = pow(Cop.xyz / max(Cop.a, 1e-6), vec3(2.2)) * Cop.a;'],
    ['mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));', 'mixed.xyz = pow(mixed.xyz / max(mixed.a, 1e-6), vec3(1.0 / 2.2)) * mixed.a;'],
  ] as const;
  for (const [before] of changes) {
    if (source.split(before).length !== 2) throw new Error(`Incompatible SMAA blend shader: ${before}`);
  }
  for (const [before, after] of changes) source = source.replace(before, after);
  return source;
}
/** The private surface is confined to this version-checked adapter. */
export function installAlphaSmaa(pass: SMAAPass): void {
  const material = (pass as unknown as { _materialBlend?: ShaderMaterial })._materialBlend;
  if (!material?.isShaderMaterial) throw new Error('Incompatible SMAA pass.');
  material.fragmentShader = alphaBlendShader(material.fragmentShader);
  material.needsUpdate = true;
}
