import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const trips=sqliteTable('trips',{id:text('id').primaryKey(),owner:text('owner').notNull(),ownerEmail:text('owner_email'),data:text('data').notNull(),revision:integer('revision').notNull().default(0),invite:text('invite').notNull()},t=>[index('trips_owner_email').on(t.ownerEmail)]);
export const members=sqliteTable('members',{id:text('id').primaryKey(),trip:text('trip').notNull(),user:text('user').notNull()});
export const grants=sqliteTable('grants',{id:text('id').primaryKey(),trip:text('trip').notNull(),email:text('email').notNull(),permissions:text('permissions').notNull(),person:text('person').notNull().default('')},t=>[index('grants_email').on(t.email),index('grants_trip').on(t.trip)]);
export const shares=sqliteTable('shares',{token:text('token').primaryKey(),trip:text('trip').notNull(),pin:text('pin').notNull().default(''),failures:integer('failures').notNull().default(0),lockedUntil:integer('locked_until').notNull().default(0)},t=>[index('shares_trip').on(t.trip)]);
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),user:text('user').notNull(),email:text('email').notNull(),expiresAt:integer('expires_at').notNull()},t=>[index('sessions_expires_at').on(t.expiresAt)]);
export const appOwner=sqliteTable('app_owner',{id:text('id').primaryKey(),user:text('user').notNull(),email:text('email').notNull()});
export const userPreferences=sqliteTable('user_preferences',{
  user:text('user').primaryKey(),
  email:text('email').notNull(),
  palette:text('palette').notNull().default('neon'),
  mode:text('mode').notNull().default('light'),
  motion:text('motion').notNull().default('smooth'),
  updatedAt:integer('updated_at').notNull(),
},t=>[index('user_preferences_email').on(t.email)]);
