import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const trips=sqliteTable('trips',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(0),invite:text('invite').notNull()});
export const members=sqliteTable('members',{id:text('id').primaryKey(),trip:text('trip').notNull(),user:text('user').notNull()});
