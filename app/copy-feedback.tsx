"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {userError} from '@/lib/ui-copy';
const Audience=createContext(false);
export function CopyAudience({owner,children}:{owner:boolean;children:ReactNode}){return <Audience.Provider value={owner}>{children}</Audience.Provider>}
export function CopyError({value,owner,rejected=false}:{value:unknown;owner?:boolean;rejected?:boolean}){const current=useContext(Audience),message=userError(value,owner??current,rejected);const refresh=/Something doesn't add up|We couldn't load|We couldn't update your read notifications/.test(message);return <>{message}{refresh&&<> <button type="button" className="secondary" onClick={()=>window.location.reload()}>Refresh</button></>}</>}
