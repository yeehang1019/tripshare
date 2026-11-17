import type {Expense, calculate} from './ledger';

// Display only: settlement eligibility stays in the canonical ledger.
export function expensePaymentLabel(bill:Expense, result:ReturnType<typeof calculate>, name:(id:string)=>string):string {
  if(bill.cancellation)return result.refundDue>0?'Cancelled · refund pending':'Cancelled';
  if(bill.payLater)return 'Paid via PayLater';
  const payers=[...new Set((bill.supplierPayments||bill.payers).filter(p=>p.amount!==0).map(p=>name(p.person)))].join(', ');
  if(result.effectivePaymentStatus==='postpaid')return result.supplierPaid>0?`Partly paid by ${payers}`:'Not paid to business';
  if(result.effectivePaymentStatus==='prepaid')return `Paid in advance by ${payers}`;
  return `Paid by ${payers}`;
}
