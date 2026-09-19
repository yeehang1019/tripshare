import ExpenseApp from './trip-app';
import {requireChatGPTUser} from './chatgpt-auth';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){
  const user=await requireChatGPTUser('/');
  const cookieStore=await cookies();
  if(!cookieStore.get('tripshare_session'))redirect('/api/session?return_to=/');
  return <ExpenseApp authenticatedEmail={user.email}/>;
}
