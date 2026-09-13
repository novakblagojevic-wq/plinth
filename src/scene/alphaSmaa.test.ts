import { expect, it } from 'vitest';
import { SMAABlendShader } from 'three/addons/shaders/SMAAShader.js';
import { alphaBlendShader } from './alphaSmaa';
it('binds the correction to each unique pinned shader expression, failing closed on drift', () => {
  const source = SMAABlendShader.fragmentShader;
  const corrected = alphaBlendShader(source); expect(corrected).not.toBe(source);
  for (const line of ['C.xyz = pow(C.xyz, vec3(2.2));','Cop.xyz = pow(Cop.xyz, vec3(2.2));','mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));']) {
    expect(() => alphaBlendShader(source.replace(line,''))).toThrow('Incompatible');
    expect(() => alphaBlendShader(source + line)).toThrow('Incompatible');
  }
  expect(() => alphaBlendShader(corrected)).toThrow('Incompatible');
});
