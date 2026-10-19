export type PackEntry={name:string;bytes:Uint8Array};
export const maxPackBytes=20_000_000,maxPackFiles=10;
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes:Uint8Array){let crc=0xFFFFFFFF;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0}
export function safePackName(name:string){return name.replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g,'_').replace(/\.\.+/g,'_').replace(/^\.+/,'').slice(0,160)||'document'}
// Store-only ZIP: bounded bytes, no dependency, no compression CPU spikes on phones.
export function offlineZIP(entries:PackEntry[]):Blob {
 if(!entries.length||entries.length>maxPackFiles+4)throw Error('Choose at most 10 booking files.');
 const names=new Set<string>(),parts:BlobPart[]=[],central:Uint8Array[]=[];let offset=0,total=0;
 for(const entry of entries){
  if(!entry.name||entry.name.includes('..')||entry.name.startsWith('/')||entry.name.includes('\\')||/[\x00-\x1f]/.test(entry.name)||names.has(entry.name))throw Error('Check offline file names.');names.add(entry.name);
  total+=entry.bytes.byteLength;if(total>maxPackBytes)throw Error('Offline pack limit: 20 MB. Choose fewer files.');
  const name=new TextEncoder().encode(entry.name),checksum=crc32(entry.bytes),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,entry.bytes.length,true);v.setUint32(22,entry.bytes.length,true);v.setUint16(26,name.length,true);header.set(name,30);
  parts.push(header.buffer,entry.bytes.slice().buffer);
  const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,checksum,true);d.setUint32(20,entry.bytes.length,true);d.setUint32(24,entry.bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);central.push(directory);offset+=header.length+entry.bytes.length;
 }
 const centralSize=central.reduce((n,d)=>n+d.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);parts.push(...central.map(c=>c.slice().buffer),end.buffer);return new Blob(parts,{type:'application/zip'});
}
