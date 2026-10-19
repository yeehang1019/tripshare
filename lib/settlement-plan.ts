import { ledger, outstandingClaims, type Event } from './ledger';

type Claim = { expense: string; amount: number };
type Edge = { from: string; to: string; claims: Claim[] };
type Route = { amount: number; edges: Edge[] };
export type PlannedTransfer = { from: string; to: string; amount: number; routes: Route[] };

// Route outstanding claims through existing creditors. No global balance credit:
// every recorded payment stays attached to its original expenses and debt edges.
export function settlementPlan(event: Event) {
  const original = ledger(event).transfers,byPair=new Map<string,Claim[]>();
  for(const claim of outstandingClaims(event)){const key=claim.from+'\0'+claim.to,list=byPair.get(key)||[];list.push({expense:claim.expense,amount:claim.amount});byPair.set(key,list)}
  const details=(from:string,to:string)=>(byPair.get(from+'\0'+to)||[]).map(c=>({...c}));
  const edges: Edge[] = original.map(t => ({from:t.from,to:t.to,claims:details(t.from,t.to).map(c=>({...c}))}));
  const balance = new Map(event.people.map(p=>[p.id,0]));
  original.forEach(t=>{balance.set(t.from,balance.get(t.from)!-t.amount);balance.set(t.to,balance.get(t.to)!+t.amount)});
  const remaining = (e:Edge) => e.claims.reduce((n,c)=>n+c.amount,0);
  const take = (e:Edge,amount:number): Edge => {
    let left=amount;const claims:Claim[]=[];
    for(const c of e.claims){const value=Math.min(c.amount,left);if(value){claims.push({expense:c.expense,amount:value});c.amount-=value;left-=value}}
    return {from:e.from,to:e.to,claims};
  };
  const result:PlannedTransfer[]=[];
  for(const person of event.people){
    while(balance.get(person.id)!<0){
      const queue:{id:string;path:Edge[]}[]=[{id:person.id,path:[]}],seen=new Set([person.id]);
      let found:{id:string;path:Edge[]}|undefined;
      for(let i=0;i<queue.length;i++){
        const node=queue[i];if(node.path.length&&balance.get(node.id)!>0){found=node;break}
        for(const edge of edges.filter(e=>e.from===node.id&&remaining(e)>0))if(!seen.has(edge.to)){seen.add(edge.to);queue.push({id:edge.to,path:[...node.path,edge]})}
      }
      if(!found)break;
      const amount=Math.min(-balance.get(person.id)!,balance.get(found.id)!,...found.path.map(remaining));
      const route={amount,edges:found.path.map(edge=>take(edge,amount))};
      const transfer=result.find(t=>t.from===person.id&&t.to===found!.id);
      if(transfer){transfer.amount+=amount;transfer.routes.push(route)}else result.push({from:person.id,to:found.id,amount,routes:[route]});
      balance.set(person.id,balance.get(person.id)!+amount);balance.set(found.id,balance.get(found.id)!-amount);
    }
  }
  // Preserve unresolved cycles rather than silently write off anyone's debt.
  for(const edge of edges){const amount=remaining(edge);if(amount){const route={amount,edges:[{...edge,claims:edge.claims.filter(c=>c.amount>0)}]},existing=result.find(t=>t.from===edge.from&&t.to===edge.to);if(existing){existing.amount+=amount;existing.routes.push(route)}else result.push({from:edge.from,to:edge.to,amount,routes:[route]})}}
  const fallback=original.map(t=>({...t,routes:[{amount:t.amount,edges:[{from:t.from,to:t.to,claims:details(t.from,t.to)}]}]}));
  return { original, simplified:result.length<original.length?result:fallback };
}

export function simplifiedAllocations(event:Event,from:string,to:string,amount:number){
  const transfer=settlementPlan(event).simplified.find(t=>t.from===from&&t.to===to);
  if(!Number.isSafeInteger(amount)||amount<=0||!transfer||amount>transfer.amount)throw Error('Simplified payment exceeds the current plan. Refresh the preview.');
  let left=amount;const allocations:{expense:string;from:string;to:string;amount:number}[]=[];
  for(const route of transfer.routes){const part=Math.min(left,route.amount);if(!part)break;
    for(const edge of route.edges){let edgeLeft=part;for(const c of edge.claims){const value=Math.min(edgeLeft,c.amount);if(value){allocations.push({expense:c.expense,from:edge.from,to:edge.to,amount:value});edgeLeft-=value}}}
    left-=part;
  }
  return allocations;
}
