/** Log a traceable storage failure without returning SQL, credentials or submitted content. */
export function storageUnavailable(operation:string,error:unknown){
 const requestId=crypto.randomUUID();
 console.error(operation,{requestId,error:error instanceof Error?error.message:'Unknown storage failure'});
 return Response.json({error:'Storage is temporarily unavailable. Your input is kept. Retry later. Reference: '+requestId,requestId},{status:503,headers:{'Cache-Control':'private, no-store'}});
}
