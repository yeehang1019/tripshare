export async function reuseSession(db:any,user:string,email:string,candidate:string,createToken:()=>string,now=Date.now()){
 const normalized=email.toLowerCase();
 if(candidate&&candidate.length<=200){const existing=await db.prepare('SELECT token,user,email,expires_at FROM sessions WHERE token=? AND expires_at>?').bind(candidate,now).first();if(existing&&existing.user===user&&existing.email===normalized)return {token:existing.token,created:false}}
 const token=createToken();await db.prepare('INSERT INTO sessions(token,user,email,expires_at) VALUES(?,?,?,?)').bind(token,user,normalized,now+30*24*60*60*1000).run();return {token,created:true};
}
