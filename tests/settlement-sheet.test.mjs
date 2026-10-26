import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {normalize,blankExpense,blankItem,calculate,ledger} from '../lib/ledger.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {sheetBills,settlementSheet,sheetTransfers,sheetPrintHTML}=await vite.ssrLoadModule('/lib/settlement-sheet.ts');
const {personalView}=await vite.ssrLoadModule('/lib/personal.ts');
const {SettlementSheetTable}=await vite.ssrLoadModule('/app/settlement-summary.tsx');
function fixture(){
 const e=normalize({name:'Group',people:['Marcus','YT','ET','ZOEY','REYES','CALVIN','YH'],bills:[],payments:[]}),b=blankExpense(e,'ET');b.merchant='Haha xiao';b.date='2026-10-22';b.items=[{...blankItem(e.people.map(p=>p.id)),name:'Food',amount:8780,split:'amount',weights:[1050,980,1080,1300,1660,1280,1430]}];e.expenses=[b];return {e,b};
}
test('The compact sheet matches the reference rows and exact RM87.80 footer without changing records',()=>{
 const {e,b}=fixture(),before=JSON.stringify(e),sheet=settlementSheet(e,b.id);
 assert.equal(sheet.title,'Haha xiao');assert.deepEqual(sheet.columns,['Food']);assert.deepEqual(sheet.rows.map(r=>r.total),[1050,980,1080,1300,1660,1280,1430]);assert.equal(sheet.total,8780);assert.deepEqual(sheet.totals,[8780]);assert.deepEqual(sheet.payTo,['ET']);
 const html=renderToStaticMarkup(React.createElement(SettlementSheetTable,{sheet}));assert.match(html,/>Food</);assert.match(html,/RM\s*87.80/);assert.equal((html.match(/scope="row"/g)||[]).length,8);assert.equal(JSON.stringify(e),before);
});
test('Mine and personal projections only contain authorized rows and bills',()=>{
 const {e,b}=fixture(),hidden=blankExpense(e,'Marcus');hidden.merchant='PRIVATE_MARCUS';hidden.items[0].people=['Marcus'];hidden.items[0].weights=[1];hidden.items[0].amount=100;e.expenses.push(hidden);
 const mine=settlementSheet(e,b.id,{person:'YH'});assert.deepEqual(mine.rows.map(r=>r.name),['YH']);assert.equal(mine.total,1430);assert.equal(settlementSheet(e,hidden.id,{person:'YH'}),null);assert.ok(!sheetBills(e,{person:'YH'}).some(b=>b.title==='PRIVATE_MARCUS'));
 const personal=personalView(e,'YH'),redacted={...e,people:[],expenses:[],payments:[]},own=settlementSheet(redacted,b.id,{personal});assert.equal(own.total,1430);assert.equal(own.rows.length,1);assert.deepEqual(own.payTo,['ET']);assert.equal(settlementSheet(redacted,hidden.id,{personal}),null);
 assert.ok(sheetTransfers(e,ledger(e).transfers,{person:'YH'}).every(t=>t.from==='YH'||t.to==='YH'));
});
test('Adjustments and FX remain distinct and totals use the existing engine',()=>{
 const {e,b}=fixture();b.voucher=100;b.voucherPeople=['YH'];b.voucherOwner='YH';
 let sheet=settlementSheet(e,b.id);assert.equal(sheet.total,calculate(b,'MYR').total);assert.equal(sheet.columns.at(-1),'Adjustment');assert.equal(sheet.rows.at(-1).values.at(-1),-100);for(const r of sheet.rows)assert.equal(r.values.reduce((n,v)=>n+v,0),r.total);
 b.currency='THB';b.rate=.13;sheet=settlementSheet(e,b.id);assert.equal(sheet.itemCurrency,'THB');assert.equal(sheet.currency,'MYR');assert.equal(sheet.columns.includes('Adjustment'),false);assert.equal(sheet.total,calculate(b,'MYR').total);
 b.deleted=true;assert.equal(settlementSheet(e,b.id),null);assert.equal(sheetBills(e).length,0);
});
test('Printing the selected sheet escapes content and retains every item in bounded-width tables',()=>{
 const {e,b}=fixture();b.merchant='<script>secret()</script>';b.items=Array.from({length:12},(_,i)=>({...blankItem(['YH']),name:'Extra '+i,amount:100}));
 const sheet=settlementSheet(e,b.id),html=sheetPrintHTML(sheet,sheetTransfers(e,ledger(e).transfers));
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Extra 11/);assert.match(html,/Continued item tables/);assert.match(html,/Final payments · all bills/);assert.match(html,/Content-Security-Policy/);assert.match(html,/26\/10\/2026|22\/10\/2026/);
 assert.match(sheetPrintHTML(sheet,[],400),/Recorded repayments need review/);
});
