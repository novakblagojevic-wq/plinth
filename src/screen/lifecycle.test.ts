import { describe, expect, it, vi } from 'vitest';
import { MeshPhysicalMaterial, ShaderLib, Texture, SRGBColorSpace } from 'three';
import { createStage } from '../scene';
import { latestImageLoader, loadImage } from './load';
import type { ImageMeta } from './types';

const meta: ImageMeta = { width: 80, height: 40, originalWidth: 80, originalHeight: 40, downscaled: false, cap: 8192, identity: 'user' };
const bitmap = () => ({ width: 80, height: 40, close: vi.fn() }) as unknown as ImageBitmap;
const physical = (stage: ReturnType<typeof createStage>) => stage.getRig().screen.material as MeshPhysicalMaterial;

describe('F5 Stage image ownership', () => {
  it('retires each replaced texture/bitmap once, while device/spec changes borrow it', () => {
    const stage = createStage('phone', 'soft-studio', 1.6);
    const first = bitmap();
    stage.setImage(first, meta);
    const texture = physical(stage).emissiveMap!;
    const disposed = vi.fn();
    texture.addEventListener('dispose', disposed);
    stage.setFit('cover'); stage.setPad(0.25); stage.setPadColor('#aabbcc');
    const changed = vi.fn();
    stage.onDeviceChange(changed);
    for (const id of ['phone', 'tablet', 'laptop', 'browser', 'card'] as const) {
      stage.setDevice(id);
      const material = physical(stage);
      expect(material.emissiveMap).toBe(texture);
      stage.setSpec({ ...stage.getSpec(), glassClearcoat: 0 });
      expect(physical(stage)).toBe(material);
      stage.setSpec({ ...stage.getSpec(), w: stage.getSpec().w * 1.1 });
      expect(physical(stage)).toBe(material);
      expect(material.emissiveMap).toBe(texture);
      expect(stage.getImage()).toEqual({ ...meta, fit: 'cover', pad: 0.25, padColor: '#aabbcc' });
      expect(disposed).not.toHaveBeenCalled();
      expect(first.close).not.toHaveBeenCalled();
    }
    expect(changed).toHaveBeenCalledTimes(14);
    stage.setImage(first, meta);
    expect(disposed).not.toHaveBeenCalled();
    const second = bitmap();
    stage.setImage(second, meta);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(first.close).toHaveBeenCalledTimes(1);
    const secondDisposed = vi.fn();
    physical(stage).emissiveMap!.addEventListener('dispose', secondDisposed);
    stage.setImage(bitmap(), meta);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(secondDisposed).toHaveBeenCalledTimes(1);
    stage.getRig().dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });
  it('exposes a snapshot and restores neutral image mode after the colour override', () => {
    const stage = createStage('card', 'soft-studio', 1.6);
    stage.setImage(bitmap(), meta);
    const material = physical(stage);
    const texture = material.emissiveMap!;
    stage.getRig().setScreenColor('#808080');
    expect(material.emissive.getHexString()).toBe('808080');
    expect(material.emissiveMap).toBe(texture);
    const copy = stage.getImage()!;
    copy.width = 1; copy.pad = 0.2;
    expect(stage.getImage()).toMatchObject({ width: 80, pad: 0 });
    stage.setImage(bitmap(), meta);
    expect(physical(stage)).toBe(material);
    expect(material.emissive.getHexString()).toBe('ffffff');
    expect(material.emissiveMap?.colorSpace).toBe(SRGBColorSpace);
  });
  it('keeps the SDF and live uniforms on physical-material recompilation for all devices', () => {
    const stage = createStage('phone', 'soft-studio', 1.6);
    stage.setImage(bitmap(), meta);
    for (const id of ['phone', 'tablet', 'laptop', 'browser', 'card'] as const) {
      stage.setDevice(id);
      const material = physical(stage);
      type Shader = Parameters<typeof material.onBeforeCompile>[0];
      const compile = () => {
        const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} } as Shader;
        material.onBeforeCompile(shader, null as never);
        return shader;
      };
      const before = compile();
      expect(before.fragmentShader).toContain('fwidth(screenEdge)');
      expect(before.fragmentShader).toContain('if (screenEdge > 0.0) discard;');
      expect(before.fragmentShader).toContain('screenRadii.w : screenRadii.z');
      expect(before.fragmentShader).not.toContain('#include <emissivemap_fragment>');
      expect(before.vertexShader).toContain('vScreenUv = uv');
      const spec = stage.getSpec();
      const radius = spec.cornerRadius - spec.bezel;
      expect(before.uniforms['screenRadii']!.value.toArray()).toEqual(id === 'browser' ? [0, 0, radius, radius] : [radius, radius, radius, radius]);
      stage.setPad(0.25);
      stage.setSpec({ ...spec, w: spec.w * 1.1 });
      const after = compile();
      expect(after.uniforms['screenMetres']).toBe(before.uniforms['screenMetres']);
      expect(after.uniforms['screenMetres']!.value.x).toBeCloseTo(spec.w * 1.1 - spec.bezel * 2);
      expect(after.fragmentShader).toBe(before.fragmentShader);
      expect(material).toBeInstanceOf(MeshPhysicalMaterial);
      expect(material.emissiveMap).toBeInstanceOf(Texture);
      expect(material.color.getHex()).toBe(0);
      expect(material.toneMapped).toBe(false);
      expect(material.envMapIntensity).toBe(0.35);
    }
  });
});

describe('F5 input transactions', () => {
  it('does not allow an older decode to replace a newer selection', async () => {
    type Result = Awaited<ReturnType<typeof loadImage>>;
    const pending: Array<(v: Result) => void> = [];
    const decode = () => new Promise<Result>((resolve) => pending.push(resolve));
    const mount = vi.fn(); const note = vi.fn();
    const select = latestImageLoader(decode, mount, note);
    const old = select('old'); const next = select('next');
    const first = bitmap(); const second = bitmap();
    pending[1]!({ bitmap: second, meta }); await next;
    pending[0]!({ bitmap: first, meta }); await old;
    expect(mount).toHaveBeenCalledExactlyOnceWith({ bitmap: second, meta });
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalledExactlyOnceWith('');
  });
  it('keeps the mounted image on failure and names the actual downscale cap on success', async () => {
    const stage = createStage('tablet', 'soft-studio', 1.6);
    stage.setImage(bitmap(), meta);
    const texture = physical(stage).emissiveMap;
    const note = vi.fn();
    const select = latestImageLoader(async () => { throw new Error('Invalid image'); },
      ({ bitmap: b, meta: m }) => stage.setImage(b, m), note);
    await expect(select('bad')).rejects.toThrow('Invalid image');
    expect(physical(stage).emissiveMap).toBe(texture);
    expect(note).toHaveBeenLastCalledWith('Invalid image');
    const resize = latestImageLoader(async () => ({ bitmap: bitmap(), meta: { ...meta, cap: 4096, downscaled: true } }), vi.fn(), note);
    await resize('large');
    expect(note.mock.lastCall?.[0]).toContain('4096');
  });
});
