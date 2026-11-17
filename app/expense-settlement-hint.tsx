import type {Expense,calculate} from '@/lib/ledger';
import type {BillSettlement} from '@/lib/settlement-display';
import {expenseSettlementExplanation} from '@/lib/expense-presentation';
export default function ExpenseSettlementHint({bill,result,rows,onReview}:{bill:Expense;result:ReturnType<typeof calculate>;rows:BillSettlement[];onReview?:()=>void}){
 const info=expenseSettlementExplanation(bill,result,rows);
 return <details className="expense-settlement-hint"><summary>{info.title}</summary><p>{info.reason}</p>{!result.settlementReady&&onReview&&<button type="button" className="text-button" onClick={onReview}>Review business payment</button>}</details>;
}
