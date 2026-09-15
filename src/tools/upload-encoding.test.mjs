import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import uploadModule from '../lib/upload.js'
const { prepareSkillImage, prepareUpscaleSourceImage, ImageUploadError } = uploadModule
const tinyJpeg = () => sharp({create:{width:32,height:16,channels:3,background:'#123456'}}).jpeg().toBuffer()

async function detailed4K() {
 const size=4096, bytes=Buffer.allocUnsafe(size*size*3);let seed=71
 for(let i=0;i<bytes.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;bytes[i]=seed>>>24}
 return sharp(bytes,{raw:{width:size,height:size,channels:3}}).blur(0.7).jpeg({quality:80}).withMetadata().toBuffer()
}

test('valid detailed 4096px JPEG fits after q80 fallback although jpeg95 and webp90 exceed 8 MiB', {timeout:60_000}, async()=>{
 const source=await detailed4K();const limit=8*1024*1024
 assert.ok(source.length<limit)
 assert.ok((await sharp(source).timeout({seconds:20}).jpeg({quality:95}).toBuffer()).length>limit)
 assert.ok((await sharp(source).timeout({seconds:20}).webp({quality:90,alphaQuality:100}).toBuffer()).length>limit)
 const result=await prepareSkillImage(source,'image/jpeg')
 assert.ok(result.buffer.length<=limit);assert.equal(result.mimeType,'image/webp')
 const metadata=await sharp(result.buffer).metadata();assert.equal(metadata.width,4096);assert.equal(metadata.height,4096);assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined)
})

test('encoding ladder reaches q65 when earlier candidates remain oversized',async()=>{
 const source=await tinyJpeg(), original=sharp.prototype.toBuffer, qualities=[]
 sharp.prototype.toBuffer=async function(){
  const quality=this.options.formatOut==='webp'?this.options.webpQuality:95;qualities.push(quality)
  return Buffer.alloc(quality===65?100:8*1024*1024+(quality===90?200:100))
 }
 try{const result=await prepareSkillImage(source,'image/jpeg');assert.deepEqual(qualities,[95,90,80,65]);assert.equal(result.buffer.length,100);assert.equal(result.mimeType,'image/webp')}
 finally{sharp.prototype.toBuffer=original}
})

test('WebP sources encode directly, preserve dimensions and alpha, and avoid a PNG intermediate',async()=>{
 const source=await sharp({create:{width:5000,height:12,channels:4,background:{r:30,g:60,b:90,alpha:0.25}}}).webp({lossless:true}).withMetadata().toBuffer()
 const original=sharp.prototype.png
 sharp.prototype.png=function(){throw Error('Unnecessary PNG intermediate')}
 try{
  const result=await prepareUpscaleSourceImage(source,'image/webp');assert.equal(result.mimeType,'image/webp')
  const metadata=await sharp(result.buffer).metadata();assert.equal(metadata.width,5000);assert.equal(metadata.height,12);assert.equal(metadata.hasAlpha,true);assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined)
 }finally{sharp.prototype.png=original}
})

test('preserve-size timeout is a 413 transport limitation with an original-URL fallback, not a corrupt-image error',async()=>{
 const source=await tinyJpeg(),original=sharp.prototype.toBuffer
 sharp.prototype.toBuffer=async function(){assert.ok(this.options.timeoutSeconds>12);assert.ok(this.options.timeoutSeconds<=90);throw Error('timeout: 90.01s')}
 try{await assert.rejects(prepareUpscaleSourceImage(source,'image/jpeg'),error=>error instanceof ImageUploadError&&error.status===413&&/original-image URL/.test(error.message)&&!/decode|corrupt/.test(error.message))}
 finally{sharp.prototype.toBuffer=original}
})

test('reference processing timeout is retryable and no candidate starts after the shared budget expires',async()=>{
 const source=await tinyJpeg(),original=sharp.prototype.toBuffer,now=Date.now;let calls=0,timeCalls=0
 sharp.prototype.toBuffer=async function(){calls++;return Buffer.alloc(8*1024*1024+1)}
 Date.now=()=>++timeCalls<=2?0:12_001
 try{await assert.rejects(prepareSkillImage(source,'image/jpeg'),error=>error instanceof ImageUploadError&&error.status===503&&/timed out/.test(error.message));assert.equal(calls,1)}
 finally{sharp.prototype.toBuffer=original;Date.now=now}
})
