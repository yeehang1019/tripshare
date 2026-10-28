import type {Event} from './ledger';
// Directory entries are deliberately empty, never financial summaries.
export function directoryEvent(name:string,kind:string):Event{return {schema:2,name,kind:kind==='trip'?'trip':'daily',start:'',end:'',currency:'MYR',settlement:'MYR',rates:{MYR:1},people:[],expenses:[],payments:[],groups:[],activities:[],audit:[],budget:0}}
