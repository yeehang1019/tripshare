import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAmount,toMinorUnits,amountInputHint,formatRate,evenPercents} from '../lib/amount-expression.ts';
import {normalize,blankExpense,blankItem,calculate} from '../lib/ledger.ts';

test('Decimal commas are rejected instead of becoming 100x amounts',()=>{
 for(const input of ['12,50','12,5','1,2345','0,99'])assert.equal(evaluateAmount(input),null,input);
 assert.match(amountInputHint('12,50'),/dot for decimals/);
});
test('Thousands separators, currency labels and full-width digits are read',()=>{
 assert.equal(evaluateAmount('1,234.56'),1234.56);
 assert.equal(evaluateAmount('12,345'),12345);
 assert.equal(evaluateAmount('RM 12.50'),12.5);
 assert.equal(evaluateAmount('rm12'),12);
 assert.equal(evaluateAmount('12 RM'),12);
 assert.equal(evaluateAmount('THB 1,000'),1000);
 assert.equal(evaluateAmount('２０'),20);
 assert.equal(evaluateAmount('3x12'),36);
 assert.equal(evaluateAmount('12.'),12);
});
test('Calculator input keeps working and rejects unsafe or unfinished input',()=>{
 assert.equal(evaluateAmount('40+10'),50);
 assert.equal(evaluateAmount('(35+5)*2'),80);
 for(const input of ['','alert(1)','10/0','1e3','12 50','1.2.3','..5','50+'])assert.equal(evaluateAmount(input),null,input);
 assert.match(amountInputHint('50+'),/Finish the calculation/);
 assert.match(amountInputHint('-5'),/negative/);
 assert.doesNotMatch(amountInputHint('-5',true),/negative/);
});
test('Minor-unit conversion has no binary rounding drift',()=>{
 assert.equal(toMinorUnits(1.005,100),101);
 assert.equal(toMinorUnits(0.1+0.2,100),30);
 assert.equal(toMinorUnits(10/3,100),333);
 assert.equal(toMinorUnits(1234.56,100),123456);
 assert.equal(toMinorUnits(1500,1),1500);
});
test('Rates display without float noise in both directions',()=>{
 assert.equal(formatRate(1/7.5),'0.133333');
 assert.equal(formatRate(7.5),'7.5');
 assert.equal(formatRate(0.13),'0.13');
 assert.equal(formatRate(0),'—');
});
test('Default percentages add to exactly 100 and pass ledger validation',()=>{
 assert.deepEqual(evenPercents(3),[33.33,33.33,33.34]);
 for(let n=1;n<=12;n++){
  const parts=evenPercents(n);assert.equal(parts.length,n);
  const people=Array.from({length:n},(_,i)=>'P'+i),e=normalize({name:'Split',people,bills:[],payments:[]});
  const b=blankExpense(e,'P0');b.merchant='Meal';b.items=[{...blankItem(people),amount:10000,split:'percent',weights:parts}];
  const c=calculate(b,'MYR');assert.equal(Object.values(c.consumed).reduce((a,v)=>a+v,0),10000,`n=${n}`);
 }
});
test('Placeholder or invalid saved rates are not treated as real rates',async()=>{
 const {usableRate}=await import('../lib/amount-expression.ts');
 assert.equal(usableRate(1),0);assert.equal(usableRate(0),0);assert.equal(usableRate(undefined),0);assert.equal(usableRate(Number.NaN),0);assert.equal(usableRate(-2),0);
 assert.equal(usableRate(0.13),0.13);assert.equal(usableRate(7.5),7.5);
});
test('Pie legend combines extra categories so it adds up to the centre total',async()=>{
 const {chartSlices,OTHER_CATEGORIES}=await import('../lib/amount-expression.ts');
 const data={Food:5000,Transport:3000,Activity:2000,Shopping:1500,Grocery:700,Accommodation:300,Other:0};
 const slices=chartSlices(data);assert.equal(slices.length,5);assert.deepEqual(slices.at(-1),[OTHER_CATEGORIES,1000]);
 assert.equal(slices.reduce((n,[,v])=>n+v,0),Object.values(data).reduce((a,b)=>a+b,0));
 assert.deepEqual(chartSlices({Food:100,Transport:50}).map(x=>x[0]),['Food','Transport']);
});
test('Global search finds bills by the date as displayed',async()=>{
 const {searchIndex,searchRecords}=await import('../lib/workspace-search.ts');
 const hits=searchIndex([{id:'g',data:{name:'QA Test',expenses:[{id:'x',merchant:'Dinner',date:'2026-11-01',category:'Food',deleted:false}],activities:[]}}]);
 assert.equal(searchRecords(hits,'01/11/2026').length,1);assert.equal(searchRecords(hits,'2026-11-01').length,1);assert.equal(searchRecords(hits,'02/11/2026').length,0);
});
test('Format helpers keep stored rates readable in details',async()=>{
 const {formatRate}=await import('../lib/amount-expression.ts');assert.equal(formatRate(1/7.5),'0.133333');assert.equal(formatRate(4.7123),'4.7123');
});
