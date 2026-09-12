// Isolated PNG transport experiment; pngjs is an existing development pin.
// This is not the browser product encoder or an adopted export acceptance gate.
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';

function straightTopDown(pixels, width, height, { flip=true, unpremultiply=true, opaque=false }={}) {
 const out=Buffer.alloc(pixels.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
  const src=((flip?height-1-y:y)*width+x)*4,dst=(y*width+x)*4,a=pixels[src+3];
  for(let c=0;c<3;c++)out[dst+c]=a===0?0:Math.min(255,Math.round(pixels[src+c]*(unpremultiply?255/a:1)));
  out[dst+3]=opaque?255:a;
 }
 return out;
}

async function roundtrip(page,pixels,width,height,options={}) {
 const straight=straightTopDown(pixels,width,height,options);
 const bytes=PNG.sync.write({width,height,data:straight});
 const decoded=PNG.sync.read(bytes);
 const composites=await page.evaluate(async ({base64,width,height})=>{
  const response=await fetch(`data:image/png;base64,${base64}`);
  const bitmap=await createImageBitmap(await response.blob());
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});
  const result=[];
  for(const background of ['black','white','checker']) {
   const image=ctx.createImageData(width,height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    const base=background==='black'?[0,0,0]:background==='white'?[255,255,255]:((Math.floor(x/8)+Math.floor(y/8))%2?[219,181,73]:[31,97,173]);
    image.data.set([...base,255],i);
   }
   ctx.putImageData(image,0,0);ctx.drawImage(bitmap,0,0);
   result.push({background,pixels:Array.from(ctx.getImageData(0,0,width,height).data)});
  }
  const dimensions=[bitmap.width,bitmap.height];bitmap.close();return {dimensions,result};
 },{base64:bytes.toString('base64'),width,height});
 const measurements=composites.result.map(({background,pixels:actual})=>{
  let max=0,total=0,over2=0;
  // Independent oracle indexes the original bottom-up premultiplied buffer.
  // It never consumes the conversion output or decoded PNG bytes.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
   const src=((height-1-y)*width+x)*4,dst=(y*width+x)*4;
   const base=background==='black'?[0,0,0]:background==='white'?[255,255,255]:((Math.floor(x/8)+Math.floor(y/8))%2?[219,181,73]:[31,97,173]);
   for(let c=0;c<3;c++) {
    const expected=Math.round(pixels[src+c]+base[c]*(255-pixels[src+3])/255);
    const error=Math.abs(actual[dst+c]-expected);max=Math.max(max,error);total+=error;if(error>2)over2++;
   }
  }
  return {background,maxChannelError:max,meanChannelError:total/(width*height*3),channelsOver2:over2};
 });
 return {pngBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),dimensions:composites.dimensions,
  losslessBytes:decoded.data.equals(straight),measurements,
  passed:decoded.data.equals(straight)&&composites.dimensions[0]===width&&composites.dimensions[1]===height&&measurements.every(m=>m.channelsOver2===0)};
}

export async function measurePNG(page,report) {
 // Two asymmetric rows, explicit alpha-zero and low/partial alpha, known RGB.
 const syntheticBottomUp=[31,97,173,255, 0,0,0,0, 64,32,16,64, 128,0,0,128, 0,64,0,128, 0,0,85,85];
 const expectedStraight=[255,0,0,128, 0,128,0,128, 0,0,255,85, 31,97,173,255, 0,0,0,0, 255,128,64,64];
 const conversionMatchesLiteral=straightTopDown(syntheticBottomUp,3,2).equals(Buffer.from(expectedStraight));
 const synthetic=await roundtrip(page,syntheticBottomUp,3,2);
 const seeds=[];
 for(const [name,options] of [['missing-unpremultiply',{unpremultiply:false}],['missing-flip',{flip:false}],['lost-alpha',{opaque:true}]]) {
  const result=await roundtrip(page,syntheticBottomUp,3,2,options);
  seeds.push({name,rejected:!result.passed,measurements:result.measurements});
 }
 const results=[];
 for(const {pixels,...identity} of report.framesForPNG)results.push({...identity,...await roundtrip(page,pixels,...report.size)});
 const renderErrors=report.results.filter(r=>r.glError);
 return {purpose:'PNG byte transport and same-foreground compositing only; not SMAA correctness, production export or mobile acceptance',
  alphaAware:report.alphaAware,size:report.size,
  criterion:'Lossless PNG bytes and exact dimensions; same-foreground sRGB composition <=2 byte values/channel (conversion quantization plus canvas rounding), alpha-zero RGB normalized to zero. Research criterion, not adopted spec.',
  conversionMatchesLiteral,synthetic,seeds,renderErrors,results,
  passed:conversionMatchesLiteral&&synthetic.passed&&seeds.every(s=>s.rejected)&&results.every(r=>r.passed)&&renderErrors.length===0};
}
