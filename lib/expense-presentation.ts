import type {BillSettlement} from './settlement-display';
import type {Expense, calculate} from './ledger';

// Display only: settlement eligibility stays in the canonical ledger.
export function expensePaymentLabel(bill:Expense, result:ReturnType<typeof calculate>, name:(id:string)=>string):string {
  if(bill.agong)return 'Paid by Agong';
  if(bill.cancellation)return result.refundDue>0?'Cancelled · refund pending':'Cancelled';
  if(bill.payLater)return 'Paid via PayLater';
  const payers=[...new Set((bill.supplierPayments||bill.payers).filter(p=>p.amount!==0).map(p=>name(p.person)))].join(', ');
  if(result.effectivePaymentStatus==='postpaid')return result.supplierPaid>0?`Partly paid by ${payers}`:'Not paid to business';
  if(result.effectivePaymentStatus==='prepaid')return `Paid in advance by ${payers}`;
  return `Paid by ${payers}`;
}

export function expenseSettlementExplanation(bill:Expense,result:ReturnType<typeof calculate>,rows:BillSettlement[]){
 const title="Why isn't this in Settle up?";
 if(!result.settlementReady){
  if(result.effectivePaymentStatus==='prepaid')return {title,reason:'Paid to the business before use. After using it, edit this same expense and update Business payment timing. Do not add another expense.'};
  return {title,reason:'The business has not been fully paid. Friend settlement starts after the business is fully paid and the expense is used. Recording a business payment is separate from repaying a friend.'};
 }
 if(rows.some(r=>r.finalDue>0))return {title:'About this settlement',reason:'This bill still has an outstanding friend repayment in Settle up. Amounts there include recorded payments and opposite debts cancelled out within each pair.'};
 const paid=rows.some(r=>r.applied>0),offset=rows.some(r=>r.offset>0);
 if(offset)return {title,reason:paid?'Recorded repayments and opposite debts cancelled out within the same pairs have cleared this bill. No further payment is due for it.':'Opposite debts within the same pairs have cancelled out this bill. No cash payment was recorded for the cancelled-out amount.'};
 if(paid)return {title,reason:'Recorded friend repayments have cleared this bill. The expense and its payment history remain unchanged.'};
 return {title,reason:bill.treat?'This expense is a treat, so its consumers do not owe a shared-cost repayment.':'This bill creates no friend-to-friend amount due in the current settlement. Paying for your own share does not create a debt to yourself.'};
}
