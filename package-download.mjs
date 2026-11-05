import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import {build} from 'vite';
const root=process.env.HOLLOW_OUTPUT_DIR||process.argv[2]||'dist/glasshouse';
const sourceRoot=fileURLToPath(new URL('.',import.meta.url));
// The hosted build has two pages with shared chunks. Make a separate in-memory
// single-entry bundle for file:// use, with GLBs embedded as data URLs and no
// imports that would require a local server. No output files are overwritten.
const offline=await build({configFile:false,root:sourceRoot,base:'./',logLevel:'warn',build:{write:false,assetsInlineLimit:Infinity,rollupOptions:{input:resolve(sourceRoot,'index.html'),output:{inlineDynamicImports:true}}}});
const output=offline.output;
if(output.some(entry=>entry.fileName.endsWith('.glb')))throw new Error('The offline build left a model outside the HTML.');
function builtFile(url){const filename=url.replace(/^\.\//,'');const file=output.find(entry=>entry.fileName===filename);if(!file)throw new Error(`Missing offline build file: ${url}`);return file.type==='chunk'?file.code:String(file.source);}
let html=builtFile('index.html');
for(const [tag,url] of [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)]){
 const js=builtFile(url);html=html.replace(tag,()=>`<script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script>`);
}
for(const [tag,url] of [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)]){const css=builtFile(url);html=html.replace(tag,()=>`<style>${css}</style>`);}
html=html.replace(/<link\b[^>]*rel="(?:modulepreload|icon)"[^>]*>/g,'');
const playUrl=process.env.HOLLOW_PLAY_URL||'https://tuffm82-pixel.github.io/The-Hollow-Array/';
const instructions=`THE HOLLOW ARRAY — DOWNLOAD EDITION\r\n\r\nExtract this ZIP and open THE HOLLOW ARRAY.html in a desktop browser. No install needed.\r\nFor iPad use the hosted Safari link: ${playUrl}\r\n\r\nWASD move / drag to look / E use / Shift run / H hide / Escape pause.\r\nTouch: left joystick, right swipe, USE, RUN, HIDE.\r\nExplore Halcyon Ridge Observatory. Find ARC, ECHO and CRYO. Defeat three creatures using their weaknesses and finish Chapter One. Click or press F to fire. On touch, tap FIRE. Use the marked room equipment to open each creature’s armour. Keys 1/2/3 switch tools. J opens the Field Journal and map. Tap or click the HUD journal button on touch. Checkpoints and discoveries save on this device.\r\nGraphics, models and sound effects are embedded; the downloaded game works offline. Spoken dialogue uses your device voices where available and may depend on the device's installed voices. Tap REPLAY RADIO to repeat a line.\r\n`;
function crc32(data){let c=0xffffffff;for(const n of data){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
const manifest=JSON.parse(await readFile(resolve(sourceRoot,'assets/creatures/manifest.json'),'utf8'));
const sources='CREATURE MODEL SOURCES\r\n\r\nSource meshes: CC0 1.0 Universal https://creativecommons.org/publicdomain/zero/1.0/\r\nCustom skeletal rigs and idle, walk, run, attack, stagger and death clips authored for THE HOLLOW ARRAY.\r\n\r\n'+manifest.map(asset=>`${asset.id}: ${asset.source}\r\nSource SHA256: ${asset.sourceSHA256}\r\n`).join('\r\n');
const entries=[['THE HOLLOW ARRAY.html',html],['START HERE.txt',instructions],['MODEL SOURCES.txt',sources]],local=[],central=[];let offset=0;
for(const [name,content] of entries){const filename=Buffer.from(name),data=Buffer.from(content),packed=deflateRawSync(data),crc=crc32(data),header=Buffer.alloc(30),record=Buffer.alloc(46);
 header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
 record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(0x21,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(packed.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);local.push(header,filename,packed);central.push(record,filename);offset+=header.length+filename.length+packed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await mkdir(`${root}/downloads`,{recursive:true});await writeFile(`${root}/downloads/THE-HOLLOW-ARRAY.zip`,Buffer.concat([...local,directory,end]));await mkdir('test-results',{recursive:true});await writeFile('test-results/THE HOLLOW ARRAY.html',html);console.log(`THE HOLLOW ARRAY: standalone HTML ${Buffer.byteLength(html)} bytes; offline ZIP packaged.`);

