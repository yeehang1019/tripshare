import {normalize,blankExpense} from '../../lib/ledger.ts';
// Pair-only, deidentified projection of the audited 26 October KL House ledger.
// Exact obligations and source-bound cash; no account IDs/emails or other pairs.
export function klHousePair(){
 const e=normalize({name:'KL House',people:['ET','YH'],bills:[],payments:[]});
 const rows=[
 ['venora','venora','2026-09-10','ET',360],['lunch','LUNCH','2026-09-13','ET',1498],
 ['wifi','wifi','2026-09-13','YH',4558],['fee','fee','2026-09-13','YH',33674],['tol','tol','2026-09-13','YH',1100],
 ['mori','mori','2026-09-16','YH',2900],['egg','EGG','2026-09-16','ET',543],['grab20','grab','2026-09-20','ET',1551],
 ['toll22','TOLL','2026-09-22','YH',550],['grab23','grab','2026-09-23','ET',1425],['food24','food','2026-09-24','ET',2447],
 ['toll25','toll','2026-09-25','YH',1650],['grab01','grab','2026-10-01','ET',1467],['power','电费去','2026-10-02','ET',33583],
 ['car','车友','2026-10-02','YH',1400],['food12','food','2026-10-12','ET',1699],['eat07','eat','2026-10-07','ET',2112],
 ['food07','food','2026-10-07','ET',1545],['food20','food','2026-10-20','ET',1640]
 ];
 for(const [id,title,date,from,share] of rows){const to=from==='ET'?'YH':'ET',b=blankExpense(e,to);b.id=id;b.date=date;b.merchant=title;b.items[0].id=id+'-item';b.items[0].amount=share*2;b.items[0].people=['ET','YH'];b.items[0].weights=[1,1];e.expenses.push(b)}
 function payment(id,date,from,amount,parts,deleted=false){e.payments.push({id,date,from,to:from==='ET'?'YH':'ET',amount,allocations:parts.map(([expense,amount])=>({expense,amount})),note:'',createdBy:'fixture',deleted})}
 payment('reversed-et','2026-09-09','ET',1586,[],true);payment('reversed-yh','2026-09-13','YH',33300,[],true);
 payment('cash-fee','2026-09-27','YH',9900,[['fee',9900]]);
 payment('cash-toll','2026-10-05','YH',2958,[['toll25',1558],['car',1400]]);
 payment('cash-food','2026-10-20','ET',2398,[['eat07',853],['food07',1545]]);
 payment('cash-power','2026-10-26','ET',12858,[['power',9900],['food12',1699],['eat07',1259]]);
 return e;
}
