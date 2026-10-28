import {measuredDatabase} from '@/lib/response-metrics';
import {env} from 'cloudflare:workers';
export function database(){return measuredDatabase((env as unknown as {DB:D1Database}).DB);}
