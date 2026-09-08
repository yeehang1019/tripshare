import {env} from 'cloudflare:workers';
export function database(){const db=(env as unknown as {DB:any}).DB;if(!db)throw new Error('Storage unavailable');return db;}
