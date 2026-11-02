import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app/glass-neon.css',import.meta.url),'utf8');
const rgb=h=>h.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16));
const mix=(a,b,alpha)=>a.map((v,i)=>v*alpha+b[i]*(1-alpha));
const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=[lum(a),lum(b)].sort((a,b)=>a-b);return (x[1]+.05)/(x[0]+.05)};
test('Glass and Neon text contrast survives brightest overlapping background blobs',()=>{
 const themes=[{bg:'#f5f5f7',surface:'#ffffff',alpha:.62,text:'#1d1d1f',secondary:'#6e6e73',primary:'#7c3aed',button:'#ffffff',blob:.12,accent:'#22d3ee'},{bg:'#07060d',surface:'#141024',alpha:.55,text:'#f5f3ff',secondary:'#a8a3c2',primary:'#a78bfa',button:'#141024',blob:.18,accent:'#d946ef'}];
 for(const t of themes){for(const a of [0,t.blob])for(const b of [0,t.blob]){const backdrop=mix(rgb('#8b5cf6'),mix(rgb(t.accent),rgb(t.bg),b),a);const panel=mix(rgb(t.surface),backdrop,t.alpha);for(const color of [t.text,t.secondary])assert.ok(contrast(rgb(color),panel)>=4.5,JSON.stringify({color,panel,contrast:contrast(rgb(color),panel)}));}assert.ok(contrast(rgb(t.primary),rgb(t.button))>=4.5)}
});
test('Transparency fallback and physical spring presets preserve platform accessibility',()=>{assert.match(css,/@supports not \(backdrop-filter/);assert.match(css,/prefers-reduced-transparency:reduce/);assert.match(css,/prefers-reduced-motion:reduce/);const motion=readFileSync(new URL('../app/motion-layer.tsx',import.meta.url),'utf8');assert.match(motion,/stiffness:500,damping:34/);assert.match(motion,/stiffness:300,damping:30/);assert.match(motion,/stiffness:260,damping:18/);assert.doesNotMatch(motion,/from 'motion/);assert.match(motion,/visibilitychange/)});
