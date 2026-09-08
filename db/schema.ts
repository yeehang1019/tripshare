import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const trips=sqliteTable('trips',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(0),invite:text('invite').notNull()});
export const members=sqliteTable('members',{id:text('id').primaryKey(),trip:text('trip').notNull(),user:text('user').notNull()});
export const grants=sqliteTable('grants',{id:text('id').primaryKey(),trip:text('trip').notNull(),email:text('email').notNull(),permissions:text('permissions').notNull(),person:text('person').notNull().default('')},t=>[index('grants_email').on(t.email),index('grants_trip').on(t.trip)]);
export const shares=sqliteTable('shares',{token:text('token').primaryKey(),trip:text('trip').notNull(),pin:text('pin').notNull().default(''),failures:integer('failures').notNull().default(0),lockedUntil:integer('locked_until').notNull().default(0)},t=>[index('shares_trip').on(t.trip)]);
