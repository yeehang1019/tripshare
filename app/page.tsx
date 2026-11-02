import ExpenseApp from './trip-app';
import PublicLanding from './public-landing';
import {getChatGPTUser} from './chatgpt-auth';
import {createTripShareSession} from './session';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const incoming=await searchParams,params=new URLSearchParams();
  for(const key of ['space','group','simple','activity','tab','view']){const value=incoming?.[key];if(typeof value==='string'&&value.length<=200)params.set(key,value);}
  const returnTo=params.size?'/?'+params.toString():'/';
  const user=await getChatGPTUser();
  if(!user)return <PublicLanding returnTo={returnTo}/>;
  const session=await createTripShareSession(user.id,user.email);
  return <ExpenseApp authenticatedEmail={user.email} authenticatedAccount={user.id} authenticatedSession={session}/>;
}
