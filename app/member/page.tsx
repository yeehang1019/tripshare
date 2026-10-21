import {requireChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import {createTripShareSession} from '../session';
import {memberPortalPath} from '@/lib/member-portal';
import MemberPortal from '../member-portal';

export const dynamic='force-dynamic';
export const metadata={title:'TripShare · My trip',robots:{index:false,follow:false},referrer:'no-referrer'};
type Params=Promise<Record<string,string|string[]|undefined>>;
export default function Page({searchParams}:{searchParams:Params}){return <SignedInMember searchParams={searchParams}/>}
async function SignedInMember({searchParams}:{searchParams:Params}){
 const params=await searchParams;
 const group=typeof params.group==='string'?params.group.slice(0,200):'';
 const person=typeof params.person==='string'?params.person.slice(0,200):'';
 const path=memberPortalPath(group,person),user=await requireChatGPTUser(path);
 const session=await createTripShareSession(user.id,user.email);
 return <MemberPortal key={JSON.stringify([group,person])} group={group} person={person} session={session} signInHref={chatGPTSignInPath(path)}/>;
}
