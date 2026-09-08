import {Event,ledger,calculate,money,unit} from './ledger';
// Excel SpreadsheetML: a genuine multi-sheet workbook, without formulas/macros.
export function exportExcel(e:Event){const name=(id:string)=>e.people.find(p=>p.id===id)?.name||id,s=ledger(e);const sheets:Record<string,unknown[][]>={
 'Dashboard':[['Event',e.name],['Type',e.kind],['Settlement currency',e.settlement],['Total spending',s.total/unit(e.settlement)],['Budget',e.budget/unit(e.settlement)]],
 'Personal Summary':[['Person','Consumed','Cash paid','Voucher contributed','Responsible','Net balance'],...Object.entries(s.people).map(([p,v])=>[name(p),v.consumed/unit(e.settlement),v.paid/unit(e.settlement),v.contribution/unit(e.settlement),v.responsible/unit(e.settlement),v.balance/unit(e.settlement)])],
 'Settlement':[['From','To','Amount','Currency'],...s.transfers.map(p=>[name(p.from),name(p.to),p.amount/unit(e.settlement),e.settlement])],
 'Expenses':[['ID','Date','Merchant','Category','Currency','Receipt total','Rate','Settlement value','Treat by','Deleted'],...e.expenses.map(b=>{const c=calculate(b,e.settlement);return [b.id,b.date,b.merchant,b.category,b.currency,c.cashTotal/unit(b.currency),b.rate,c.total/unit(e.settlement),name(b.treat),b.deleted?'Yes':'No']})],
 'Items':[['Bill ID','Item','Price','Item discount','Currency','Consumers','Split'],...e.expenses.flatMap(b=>b.items.map(i=>[b.id,i.name,i.amount/unit(b.currency),i.discount/unit(b.currency),b.currency,i.people.map(name).join(', '),i.split]))],
 'Payments':[['ID','From','To','Amount','Currency','Date','Note','Recorded by','Reversed'],...e.payments.map(p=>[p.id,name(p.from),name(p.to),p.amount/unit(e.settlement),e.settlement,p.date,p.note,p.createdBy,p.deleted?'Yes':'No'])],
 'Itinerary':[['Date','Time','Activity','Location','Link','Notes','Estimate','Currency'],...e.activities.map(a=>[a.date,a.time,a.name,a.location,a.url,a.notes,a.budget/unit(e.settlement),e.settlement])],
 'Audit Log':[['Date','Actor','Action','Entity','Before','After'],...e.audit.map(a=>[a.date,a.actor,a.action,a.entity,JSON.stringify(a.before),JSON.stringify(a.after)])]};
 const xml=(x:unknown)=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
 const content='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+Object.entries(sheets).map(([n,rows])=>'<Worksheet ss:Name="'+xml(n)+'"><Table>'+rows.map(row=>'<Row>'+row.map(v=>'<Cell><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+xml(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet>').join('')+'</Workbook>';
 const url=URL.createObjectURL(new Blob([content],{type:'application/xml'}));const a=document.createElement('a');a.href=url;a.download='TripShare_Excel_Report.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
