/** Runs unchanged on Windows CI: actual OS paths and file:// URLs, Sharp and real filesystem I/O; HTTP is mocked. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join, isAbsolute, win32 } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import uploadModule from '../lib/upload.js'
import skillsModule from './skills.js'
const { processAndUploadSkillImage, processAndUploadUpscaleImage }=uploadModule
const { classifySkillImageSource }=skillsModule

test('native absolute and file URL paths read, sanitize and upload an image without changing upscale dimensions',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'meigen-native-upload-')),path=join(directory,'商品 photo with spaces.png')
 const source=await sharp({create:{width:5000,height:12,channels:4,background:{r:12,g:34,b:56,alpha:0.4}}}).png().withMetadata().toBuffer()
 await writeFile(path,source)
 const previous=globalThis.fetch,uploads=[]
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/presign'))return Response.json({success:true,presignedUrl:'https://storage.example/mock-put',publicUrl:`https://images.meigen.ai/uploads/native-${uploads.length}.png`})
  assert.equal(init.method,'PUT');uploads.push(Buffer.from(init.body));return new Response(null)
 }
 try{
  assert.equal(isAbsolute(path),true);if(process.platform==='win32')assert.equal(win32.isAbsolute(path),true)
  const fromFileUrl=classifySkillImageSource(pathToFileURL(path).href);assert.equal(fromFileUrl.kind,'local');assert.equal(fromFileUrl.path,path)
  const config={uploadGatewayUrl:'https://upload.example',meigenBaseUrl:'https://api.example',openaiBaseUrl:'https://byok.example',openaiModel:'test'}
  await processAndUploadSkillImage(path,config);await processAndUploadUpscaleImage(fromFileUrl.path,config)
  assert.equal(uploads.length,2)
  for(const [index,bytes]of uploads.entries()){
   const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,index===0?4096:5000);assert.equal(metadata.hasAlpha,true)
   for(const key of ['exif','xmp','icc','iptc'])assert.equal(metadata[key],undefined)
  }
 }finally{globalThis.fetch=previous;await rm(directory,{recursive:true,force:true})}
})
