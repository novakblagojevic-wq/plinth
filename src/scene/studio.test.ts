import { Group } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  shadows: [] as Array<{ group: Group; fit: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn>; setParams: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
  pipeline: { ready: Promise.resolve(), render: vi.fn(), setSize: vi.fn(), dispose: vi.fn() },
}));
vi.mock('./environment', () => ({ generateEnvironment: () => ({ texture: {}, dispose: vi.fn() }) }));
vi.mock('./pipeline', () => ({ createPipeline: () => fake.pipeline }));
vi.mock('./contactShadow', () => ({
  ContactShadow: class {
    group = new Group(); fit = vi.fn(); render = vi.fn(); setParams = vi.fn(); dispose = vi.fn();
    constructor() { fake.shadows.push(this); }
  },
}));
import { createStage } from '../scene';
import { createStudio } from './studio';

const originalDocument = globalThis.document;
afterEach(() => {
  fake.shadows.length = 0;
  fake.pipeline.render.mockClear(); fake.pipeline.setSize.mockClear(); fake.pipeline.dispose.mockClear();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
});

describe('T-P5 studio shadow lifecycle', () => {
  it('fits measured world bounds, dirties only geometry, retries failures, and disposes ownership', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { style: {} } } });
    const stage = createStage('phone', 'soft-studio', 16 / 10);
    const renderer = { compileAsync: vi.fn().mockResolvedValue(undefined), toneMapping: 0, toneMappingExposure: 0, getViewport: vi.fn(v => v), getScissor: vi.fn(v => v), getScissorTest: () => false, setViewport: vi.fn(), setScissor: vi.fn(), setScissorTest: vi.fn(), setClearColor: vi.fn() };
    const studio = createStudio(renderer as never, stage, { msaa: false });
    await studio.ready;
    const shadow = fake.shadows[0]!;
    studio.render();
    expect(shadow.fit).toHaveBeenCalledWith(expect.objectContaining({ min: stage.getWorldBounds().min, max: stage.getWorldBounds().max }));
    expect(shadow.render).toHaveBeenCalledTimes(1);
    stage.setAspect(1); stage.orbit(0.1, 0); studio.render();
    expect(shadow.render).toHaveBeenCalledTimes(1);
    stage.setSpec({ ...stage.getSpec(), frameRoughness: 0.5 }); studio.render();
    expect(shadow.render).toHaveBeenCalledTimes(1);
    stage.setSpec({ ...stage.getSpec(), w: stage.getSpec().w * 1.01 }); studio.render();
    expect(shadow.render).toHaveBeenCalledTimes(2);
    stage.setPose('lean', true);
    shadow.render.mockImplementationOnce(() => { throw new Error('shadow failed'); });
    expect(() => studio.render()).toThrow('shadow failed');
    expect(shadow.render).toHaveBeenCalledTimes(3);
    studio.render();
    expect(shadow.render).toHaveBeenCalledTimes(4);
    const tone = { studio: studio.getToneMapping(), renderer: renderer.toneMapping };
    expect(() => studio.setToneMapping('wrong' as never)).toThrow('Unknown tone mapping');
    expect(studio.getToneMapping()).toBe(tone.studio); expect(renderer.toneMapping).toBe(tone.renderer);
    expect(stage.scene.children).toContain(shadow.group);
    studio.dispose();
    expect(stage.scene.children).not.toContain(shadow.group);
    expect(shadow.dispose).toHaveBeenCalledTimes(1);
  });
});

it('T-P6 cleans acquired studio resources and subscriptions after warm-up failure', async () => {
  const stage = createStage('phone','soft-studio',.8);
  const renderer = {compileAsync:vi.fn().mockRejectedValue(new Error('warm failed')),toneMapping:0,toneMappingExposure:0};
  const studio=createStudio(renderer as never,stage,{msaa:false});
  const shadow=fake.shadows[0]!;
  await expect(studio.ready).rejects.toThrow('warm failed');
  studio.dispose();expect(fake.pipeline.dispose).toHaveBeenCalledTimes(1);expect(shadow.dispose).toHaveBeenCalledTimes(1);expect(stage.scene.children).not.toContain(shadow.group);expect(stage.scene.environment).toBeNull();
  stage.setPose('lean',true);stage.dispose();
});
