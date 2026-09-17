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

/* Reference VIDEO / AUDIO uploads: real files on disk, real magic-byte detection, mocked HTTP.
   Nothing here goes through Sharp — a reference clip must reach the vendor byte-identical. */
import { createHash } from 'node:crypto'
import * as referencesNamespace from '../lib/generation-references.js'
const references = referencesNamespace.default ?? referencesNamespace
const { fingerprintMediaReferences, uploadMediaReferences, detectReferenceMedia, mergeReferenceVideos, mediaReferenceUrl } = references

const mediaConfig = { uploadGatewayUrl: 'https://upload.example', meigenBaseUrl: 'https://api.example', meigenApiToken: 'meigen_sk_test_not_a_real_credential', openaiBaseUrl: 'https://byok.example', openaiModel: 'test' }

function isoBaseMediaFile(brand) {
  return Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftyp'), Buffer.from(brand), Buffer.alloc(24, 7)])
}
function waveFile() {
  return Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WAVE'), Buffer.from('fmt '), Buffer.alloc(16, 1)])
}
function riffWebpFile() {
  return Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(16, 2)])
}

test('local clips are detected by magic bytes, fingerprinted by exact bytes and presigned as video/audio', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meigen-reference-media-'))
  const files = {
    mp4: { path: join(directory, '素材 clip.mp4'), bytes: isoBaseMediaFile('isom'), contentType: 'video/mp4', kind: 'video' },
    mov: { path: join(directory, 'clip.mov'), bytes: isoBaseMediaFile('qt  '), contentType: 'video/quicktime', kind: 'video' },
    wav: { path: join(directory, 'tone.wav'), bytes: waveFile(), contentType: 'audio/wav', kind: 'audio' },
    id3: { path: join(directory, 'tagged.mp3'), bytes: Buffer.concat([Buffer.from('ID3'), Buffer.alloc(29, 0)]), contentType: 'audio/mpeg', kind: 'audio' },
    raw: { path: join(directory, 'bare.mp3'), bytes: Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x00]), Buffer.alloc(28, 0)]), contentType: 'audio/mpeg', kind: 'audio' },
  }
  for (const file of Object.values(files)) await writeFile(file.path, file.bytes)
  const previous = globalThis.fetch
  const presigns = []
  const puts = []
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/api/upload/reference-video')) {
      presigns.push({ url: String(url), authorization: new Headers(init.headers).get('Authorization'), body: JSON.parse(init.body) })
      return Response.json({ success: true, presignedUrl: `https://storage.example/put-${presigns.length}`, publicUrl: `https://images.meigen.ai/ref-videos/2026-09-17/${presigns.length}.bin` })
    }
    assert.equal(init.method, 'PUT')
    puts.push({ contentType: new Headers(init.headers).get('Content-Type'), bytes: Buffer.from(init.body) })
    return new Response(null)
  }
  try {
    // Extension alone decides nothing: detection reads the container header.
    assert.deepEqual(detectReferenceMedia(files.mp4.bytes, 'anything.bin'), { kind: 'video', contentType: 'video/mp4' })
    assert.deepEqual(detectReferenceMedia(files.mov.bytes, 'anything.bin'), { kind: 'video', contentType: 'video/quicktime' })
    assert.deepEqual(detectReferenceMedia(files.wav.bytes, 'tone.wav'), { kind: 'audio', contentType: 'audio/wav' })
    // A RIFF/WEBP image must never be accepted as WAV by the shared RIFF prefix.
    assert.equal(detectReferenceMedia(riffWebpFile(), 'fake.wav'), null)

    const videos = await fingerprintMediaReferences([files.mp4.path, files.mov.path, 'https://images.meigen.ai/existing.mp4'], 'video')
    assert.deepEqual(videos.map(item => item.identity), [
      createHash('sha256').update(files.mp4.bytes).digest('hex'),
      createHash('sha256').update(files.mov.bytes).digest('hex'),
      'https://images.meigen.ai/existing.mp4',
    ])
    // The fingerprint is a receipt, not a payload: a 200 MiB clip must not sit in memory until upload.
    assert.deepEqual(videos.map(item => item.bytes), [undefined, undefined, undefined])
    assert.deepEqual(videos.slice(0, 2).map(item => [item.path, item.size]), [[files.mp4.path, files.mp4.bytes.length], [files.mov.path, files.mov.bytes.length]])
    const audios = await fingerprintMediaReferences([files.wav.path, files.id3.path, files.raw.path], 'audio')
    assert.deepEqual(audios.map(item => item.contentType), ['audio/wav', 'audio/mpeg', 'audio/mpeg'])

    const videoUrls = await uploadMediaReferences(videos, 'seedance-2-5', mediaConfig)
    const audioUrls = await uploadMediaReferences(audios, 'seedance-2-5', mediaConfig)
    // The already-public URL is passed through untouched; only the two local clips are uploaded.
    assert.equal(videoUrls[2], 'https://images.meigen.ai/existing.mp4')
    assert.equal(presigns.length, 5)
    assert.equal(audioUrls.length, 3)
    for (const presign of presigns) {
      assert.equal(presign.url, 'https://api.example/api/upload/reference-video')
      assert.equal(presign.authorization, 'Bearer meigen_sk_test_not_a_real_credential')
      assert.equal(presign.body.modelId, 'seedance-2-5')
    }
    assert.deepEqual(presigns.map(item => item.body.kind), ['video', 'video', 'audio', 'audio', 'audio'])
    assert.deepEqual(presigns.map(item => item.body.contentType), ['video/mp4', 'video/quicktime', 'audio/wav', 'audio/mpeg', 'audio/mpeg'])
    assert.deepEqual(presigns.map(item => item.body.size), [files.mp4.bytes.length, files.mov.bytes.length, files.wav.bytes.length, files.id3.bytes.length, files.raw.bytes.length])
    assert.equal(presigns[0].body.filename, '素材 clip.mp4')
    // Uploaded bytes are exactly the fingerprinted bytes — no transcode, no metadata stripping.
    assert.deepEqual(puts.map(item => item.contentType), ['video/mp4', 'video/quicktime', 'audio/wav', 'audio/mpeg', 'audio/mpeg'])
    assert.equal(Buffer.compare(puts[0].bytes, files.mp4.bytes), 0)
    assert.equal(Buffer.compare(puts[2].bytes, files.wav.bytes), 0)
  } finally { globalThis.fetch = previous; await rm(directory, { recursive: true, force: true }) }
})

test('a mislabelled or wrong-kind local clip is rejected before any upload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meigen-reference-media-bad-'))
  const renamedImage = join(directory, 'not-really.mp4')
  const audioAsVideo = join(directory, 'tone.wav')
  await writeFile(renamedImage, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47]), Buffer.alloc(28, 0)]))
  await writeFile(audioAsVideo, waveFile())
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('must not upload an unvalidated file') }
  try {
    await assert.rejects(fingerprintMediaReferences([renamedImage], 'video'), /MP4 or MOV/)
    await assert.rejects(fingerprintMediaReferences([audioAsVideo], 'video'), /MP4 or MOV/)
    await assert.rejects(fingerprintMediaReferences([renamedImage], 'audio'), /WAV or MP3/)
  } finally { globalThis.fetch = previous; await rm(directory, { recursive: true, force: true }) }
})

test('the deprecated scalar merges with the array only when they agree on the first clip', () => {
  const first = 'https://images.meigen.ai/a.mp4'
  const second = 'https://images.meigen.ai/b.mp4'
  assert.deepEqual(mergeReferenceVideos(undefined, undefined), [])
  assert.deepEqual(mergeReferenceVideos(first, undefined), [first])
  assert.deepEqual(mergeReferenceVideos(undefined, [first, second]), [first, second])
  assert.deepEqual(mergeReferenceVideos(first, [first, second]), [first, second])
  assert.throws(() => mergeReferenceVideos(second, [first]), /first entry of referenceVideos/)
})

test('a clip edited between fingerprint and upload is refused instead of being paid for as the old one', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meigen-reference-media-drift-'))
  const path = join(directory, 'clip.mp4')
  await writeFile(path, isoBaseMediaFile('isom'))
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('must not upload bytes the fingerprint never covered') }
  try {
    const [reference] = await fingerprintMediaReferences([path], 'video')
    // Same length, different content: only the re-hash catches this, not the size check.
    await writeFile(path, Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftyp'), Buffer.from('isom'), Buffer.alloc(24, 9)]))
    await assert.rejects(uploadMediaReferences([reference], 'seedance-2-5', mediaConfig), error => {
      assert.equal(error.code, 'reference_changed')
      return true
    })
    // A truncated file is caught too, before any presign.
    await writeFile(path, Buffer.alloc(8, 0))
    await assert.rejects(uploadMediaReferences([reference], 'seedance-2-5', mediaConfig), /changed after it was fingerprinted/)
  } finally { globalThis.fetch = previous; await rm(directory, { recursive: true, force: true }) }
})

test('reference clip URLs are limited to the MeiGen image CDN the backend can probe', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('a rejected URL must never reach the network') }
  try {
    assert.equal(mediaReferenceUrl('https://images.meigen.ai/ref-videos/a.mp4', 'video'), 'https://images.meigen.ai/ref-videos/a.mp4')
    for (const kind of ['video', 'audio']) {
      assert.throws(() => mediaReferenceUrl('https://cdn.example.com/a.mp4', kind), error => {
        assert.equal(error.code, 'invalid_reference')
        assert.match(error.message, /images\.meigen\.ai/)
        assert.match(error.message, /local file path/)
        return true
      })
    }
    // Subdomain and lookalike hosts are not the CDN either.
    assert.throws(() => mediaReferenceUrl('https://evil.images.meigen.ai/a.mp4', 'video'), /images\.meigen\.ai/)
    assert.throws(() => mediaReferenceUrl('https://images.meigen.ai.attacker.test/a.mp4', 'audio'), /images\.meigen\.ai/)
    await assert.rejects(fingerprintMediaReferences(['https://cdn.example.com/track.mp3'], 'audio'), /images\.meigen\.ai/)
  } finally { globalThis.fetch = previous }
})
