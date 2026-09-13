import { describe, expect, it } from 'vitest';
import { outputDimensions, paddedDistance, fitOutput } from './output';
describe('P-13 output contract', () => {
  it.each([['1:1',1080,1080],['4:5',1080,1350],['16:9',1920,1080],['9:16',1080,1920],['3:1',1920,640]] as const)('%s has literal dimensions at every scale', (aspect,w,h) => {
    for (const scale of [1,2,3] as const) expect(outputDimensions(aspect,scale)).toEqual({width:w*scale,height:h*scale});
  });
  it('rejects invalid requests and keeps padding distinct from image fit', () => {
    expect(() => outputDimensions('toString' as never)).toThrow(); expect(() => outputDimensions('1:1',4 as never)).toThrow();
    expect(paddedDistance(12,0)).toBe(12); expect(paddedDistance(12,.25)).toBe(24); expect(paddedDistance(12,.1)).toBe(15);
    for (const x of [-1,.251,NaN,Infinity]) expect(() => paddedDistance(12,x)).toThrow();
    expect(fitOutput(960,800,'4:5')).toEqual({w:640,h:800}); expect(fitOutput(400,320,'4:5')).toEqual({w:256,h:320});
  });
});
