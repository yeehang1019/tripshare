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

// Read-only batch lookup. Keys are seeded on binding changes / first login.
export async function linkedPeopleBatch(db:any,trips:string[],grants:any[]){
 const result=new Map<string,Record<string,string>>(),bindings:{trip:string;person:string;email:string}[]=[];
 for(const trip of trips){result.set(trip,{});const people=new Map<string,string[]>();for(const g of grants)if(g.trip===trip&&g.person){const emails=people.get(g.person)||[];emails.push(g.email);people.set(g.person,emails)}for(const [person,emails] of people)if(emails.length===1)bindings.push({trip,person,email:emails[0]})}
 const emails=[...new Set(bindings.map(b=>b.email))];if(!emails.length)return result;
 const links=await db.prepare('SELECT email,identity_key FROM account_links WHERE email IN (SELECT value FROM json_each(?))').bind(JSON.stringify(emails)).all();
 const keys=new Map<string,string>(links.results.map((r:any)=>[r.email,r.identity_key]));
 for(const b of bindings){const key=keys.get(b.email);if(!key)throw Error('Member identity unavailable');result.get(b.trip)![b.person]=key}
 return result;
}

export function identitySeed(db:any,email:string){return db.prepare('INSERT OR IGNORE INTO account_links(email,identity_key) VALUES(?,?)').bind(email.toLowerCase(),crypto.randomUUID())}
