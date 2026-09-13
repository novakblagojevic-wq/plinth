import { expect, it, vi } from 'vitest';
import { createDownload } from './download';
const capture=()=>({straightAlpha:true as const,pixels:new Uint8Array([12,34,56,255]),width:1,height:1,filename:'plinth-phone-soft-studio-1x1-1x.png',peakBytes:1});
it('one job, snapshot name, URL replacement/dispose and no stale success',async()=>{
  let resolve!: (b:Blob)=>void;
  const encode=vi.fn(()=>new Promise<Blob>(r=>{resolve=r;}));const urls={createObjectURL:vi.fn(()=> 'blob:one'),revokeObjectURL:vi.fn()};
  const job=createDownload(capture,encode,urls);const first=job.run(1);
  await expect(job.run(2)).rejects.toThrow('već');resolve(new Blob());await first;
  expect(job.get().result?.filename).toBe('plinth-phone-soft-studio-1x1-1x.png');
  const next=job.run(2);expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:one');job.invalidate('lost');resolve(new Blob());await next;
  expect(job.get()).toEqual({busy:false,message:'lost'});expect(urls.createObjectURL).toHaveBeenCalledTimes(1);
  const last=job.run(1);job.dispose();resolve(new Blob());await last;expect(urls.createObjectURL).toHaveBeenCalledTimes(1);
});
it.each(['capture','encode','url'])('does not publish on %s failure and permits explicit retry',async phase=>{
  let fail=true;const urls={createObjectURL:()=>{if(fail&&phase==='url')throw new Error('url');return 'blob:valid';},revokeObjectURL:vi.fn()};
  const job=createDownload(()=>{if(fail&&phase==='capture')throw new Error('capture');return capture();},async()=>{if(fail&&phase==='encode')throw new Error('encode');return new Blob();},urls);
  await expect(job.run(1)).rejects.toThrow(phase);expect(job.get().result).toBeUndefined();expect(job.get().busy).toBe(false);
  fail=false;await job.run(1);expect(job.get().result?.url).toBe('blob:valid');job.dispose();
});
