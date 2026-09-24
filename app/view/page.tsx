import TripApp from '../trip-app';
import {requireChatGPTUser} from '../chatgpt-auth';
import {createTripShareSession} from '../session';
export const metadata={title:'TripShare · Shared event',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page(){
  const user=await requireChatGPTUser('/view');
  const session=await createTripShareSession(user.id,user.email);
  return <TripApp shared authenticatedEmail={user.email} authenticatedSession={session}/>;
}
