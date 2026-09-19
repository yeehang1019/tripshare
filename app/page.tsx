import ExpenseApp from './trip-app';
import {requireChatGPTUser} from './chatgpt-auth';
import {createTripShareSession} from './session';
export const dynamic='force-dynamic';
export default async function Page(){
  const user=await requireChatGPTUser('/');
  const session=await createTripShareSession(user.id,user.email);
  return <ExpenseApp authenticatedEmail={user.email} authenticatedSession={session}/>;
}
