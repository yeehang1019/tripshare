export async function linkedPeople(db:any,trip:string){
  const grants=await db.prepare("SELECT email,person FROM grants WHERE trip=? AND person<>''").bind(trip).all();
  const keys:Record<string,string>={};
  const byPerson=new Map<string,string[]>();
  for(const g of grants.results as any[]){const emails=byPerson.get(g.person)||[];emails.push(g.email);byPerson.set(g.person,emails)}
  for(const [person,emails] of byPerson){if(emails.length!==1)continue;
    await db.prepare('INSERT OR IGNORE INTO account_links(email,identity_key) VALUES(?,?)').bind(emails[0],crypto.randomUUID()).run();
    const link=await db.prepare('SELECT identity_key FROM account_links WHERE email=?').bind(emails[0]).first();keys[person]=link.identity_key;
  }
  return keys;
}
