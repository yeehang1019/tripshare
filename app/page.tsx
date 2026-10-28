import ExpenseApp from './trip-app';
import {requireChatGPTUser} from './chatgpt-auth';
import {createTripShareSession} from './session';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const incoming=await searchParams,params=new URLSearchParams();
  for(const key of ['space','group','simple','activity']){const value=incoming?.[key];if(typeof value==='string'&&value.length<=200)params.set(key,value);}
  const user=await requireChatGPTUser(params.size?'/?'+params.toString():'/');
  const session=await createTripShareSession(user.id,user.email);
  return <ExpenseApp authenticatedEmail={user.email} authenticatedAccount={user.id} authenticatedSession={session}/>;
}
