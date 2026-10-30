'use client';
import {useState} from 'react';
import {Link2} from 'lucide-react';
import type {Event} from '@/lib/ledger';
import {memberPortalPath} from '@/lib/member-portal';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export default function MemberLinkPicker({group,people}:{group:string;people:Event['people']}){
 const [open,setOpen]=useState(false),[person,setPerson]=useState(''),[link,setLink]=useState(''),[notice,setNotice]=useState('');
 const members=people.filter(p=>p.active!==false),selected=members.find(p=>p.id===person);
 return <><button type="button" className="secondary" disabled={!group} onClick={()=>{setNotice('');setLink('');setOpen(true)}}><Link2 size={17}/> Copy member link</button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="member-link-sheet"><DialogTitle>Share a personal trip view</DialogTitle><DialogDescription>They'll see their own Money, the Trip spending total and the itinerary. They must sign in with their linked account.</DialogDescription>
   <label className="field"><span>Who is this link for?</span><select value={person} onChange={e=>{setPerson(e.target.value);setLink('');setNotice('')}}><option value="">Choose a member</option>{members.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <button type="button" className="primary" disabled={!selected} onClick={async()=>{if(!selected)return;const url=window.location.origin+memberPortalPath(group,selected.id);setLink(url);try{await navigator.clipboard.writeText(url);setNotice('Personal link copied for '+selected.name)}catch{setNotice('Select and copy the link below.')}}}>Copy personal link</button>
   {notice&&<p role="status">{notice}</p>}{link&&<><label className="field"><span>{selected?.name}’s link</span><input readOnly value={link} onFocus={e=>e.target.select()}/></label><a className="text-button" href={link} target="_blank" rel="noreferrer">Open personal view</a></>}
   <small>Link their sign-in email in Money → People &amp; Access first. The same link keeps showing current information.</small>
  </DialogContent></Dialog></>;
}
