import {database} from '@/db/raw';
import {reuseSession} from '@/lib/session-reuse';
import {sessionCandidate,sessionForRequest,sessionIssued,deferSessionCleanup} from '@/lib/response-metrics';
export async function createTripShareSession(user:string,email:string){
 return sessionForRequest(async()=>{
  const result=await reuseSession(database(),user,email,sessionCandidate(),()=>crypto.randomUUID()+crypto.randomUUID());
  if(result.created)sessionIssued(result.token);
  deferSessionCleanup(()=>database().prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run());
  return result.token;
 });
}
