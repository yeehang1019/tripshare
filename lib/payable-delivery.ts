// Persistent, coalescing notification outbox. No financial records are changed.
export async function deliverPayables(db:any,config:any){
 if(!config.POCKET_PAYABLE_URL||!config.POCKET_SYNC_TOKEN||!config.POCKET_SITE_SERVICE_TOKEN)return;
 const url=new URL(config.POCKET_PAYABLE_URL);
 if(url.origin!=='https://pocket-ledger-migrated-20261022.yeehanglau486.chatgpt.site'||url.pathname!=='/api/trip-payables/push')throw Error('Invalid payable delivery destination');
 const lease=crypto.randomUUID(),now=Date.now();
 const job=await db.prepare("UPDATE payable_delivery SET lease=?,lock_until=? WHERE id='payables' AND delivered<revision AND next_attempt<=? AND lock_until<? RETURNING revision").bind(lease,now+30000,now,now).first();if(!job)return;
 let message='';
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+config.POCKET_SYNC_TOKEN,'OAI-Sites-Authorization':'Bearer '+config.POCKET_SITE_SERVICE_TOKEN},signal:AbortSignal.timeout(7000)});
   if(!response.ok)throw Error('Delivery failed ('+response.status+')');
   await db.prepare("UPDATE payable_delivery SET delivered=?,attempts=0,error='',lease='',lock_until=0,next_attempt=0 WHERE id='payables' AND lease=?").bind(job.revision,lease).run();return;
  }catch(error){message=error instanceof Error?error.message:'Delivery failed';if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*(2**attempt)))}
 }
 await db.prepare("UPDATE payable_delivery SET attempts=attempts+1,error=?,lease='',lock_until=0,next_attempt=? WHERE id='payables' AND lease=?").bind(message,Date.now()+30000,lease).run();
}
