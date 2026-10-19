import {blankExpense,type Event} from './ledger';
export type ExpenseTemplate={id:string;name:string;amount:number;currency:string;category:string;group:string;payer:string;people?:string[];pinned?:boolean};
export function templateExpense(template:ExpenseTemplate,event:Event,group:string){
 if(template.group&&template.group!==group)throw Error('This Quick Pick belongs to another group.');
 const payer=event.people.find(p=>p.id===template.payer&&p.active!==false)?.id||event.people.find(p=>p.active!==false)?.id||'';
 const expense=blankExpense(event,payer),saved=template.group===group?template.people||[]:[];
 const people=saved.filter(id=>event.people.some(p=>p.id===id&&p.active!==false));
 Object.assign(expense,{merchant:template.name,category:template.category,currency:template.currency,rate:template.currency===event.settlement?1:event.rates[template.currency]||0});
 expense.items[0].amount=template.amount;expense.items[0].people=people;expense.items[0].weights=people.map(()=>1);
 return {expense,missingPeople:saved.length!==people.length};
}
