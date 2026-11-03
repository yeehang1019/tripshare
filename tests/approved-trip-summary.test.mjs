import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
const Summary=(await vite.ssrLoadModule('/app/trip-summary.tsx')).default;
after(()=>vite.close());
function render(overrides={},props={}){const event={...normalize({name:'Actual trip',people:['Actual member'],bills:[],payments:[]}),destination:'Actual destination',start:'2099-01-01',end:'2099-01-03',budget:0,...overrides};return renderToStaticMarkup(React.createElement(Summary,{event,consumed:531200,plans:7,booked:2,tasks:0,done:0,onItinerary(){},...props}))}
test('Trip summary uses supplied canonical spending and real dates without inventing a budget or checklist',()=>{const html=render();assert.match(html,/Actual destination/);assert.match(html,/Departure in/);assert.match(html,/5,312\.00/);assert.match(html,/01\/01\/2099/);assert.doesNotMatch(html,/progressbar|preparation tasks|Bangkok|JL|Passport|8,000/)});
test('Trip budget progress retains actual percentage while bounding the visual track',()=>{const html=render({budget:500000},{tasks:3,done:1});assert.match(html,/106% of/);assert.match(html,/data-level="over"/);assert.match(html,/aria-valuenow="100"/);assert.match(html,/1 of 3 preparation tasks complete/)});
test('Missing or invalid trip dates never fabricate departure or day counts',()=>{for(const [start,end] of [['',''],['invalid','2099-01-03'],['2099-01-03','2099-01-01']]){const html=render({start,end});assert.match(html,/Dates not set/);assert.doesNotMatch(html,/NaN|Departure in|Day \d/)}});
