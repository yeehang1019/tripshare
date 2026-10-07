import {sqliteTable,text,integer,index,primaryKey} from 'drizzle-orm/sqlite-core';
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
export const syncChanges=sqliteTable('sync_changes',{
  seq:integer('seq').primaryKey({autoIncrement:true}),
  trip:text('trip').notNull(),
  kind:text('kind').notNull(),
  recordId:text('record_id').notNull(),
  members:text('members').notNull(),
  changedAt:text('changed_at').notNull(),
},t=>[index('sync_changes_trip_seq').on(t.trip,t.seq)]);
export const syncLimits=sqliteTable('sync_limits',{
  key:text('key').primaryKey(), count:integer('count').notNull(),
},t=>[]);

export const personalWorkspace=sqliteTable('personal_workspace',{email:text('email').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(0)});
export const memberInvitations=sqliteTable('member_invitations',{token:text('token').primaryKey(),trip:text('trip').notNull(),person:text('person').notNull(),email:text('email').notNull(),expiresAt:integer('expires_at').notNull(),acceptedEmail:text('accepted_email')},t=>[index('member_invitations_trip').on(t.trip)]);
export const accountLinks=sqliteTable('account_links',{email:text('email').primaryKey(),identityKey:text('identity_key').notNull().unique()});
export const payoutCards=sqliteTable('payout_cards',{trip:text('trip').notNull(),person:text('person').notNull(),email:text('email').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.trip,t.person]})]);
export const tripPhotos=sqliteTable('trip_photos',{id:text('id').primaryKey(),trip:text('trip').notNull(),caption:text('caption').notNull(),mime:text('mime').notNull(),createdAt:text('created_at').notNull()},t=>[index('trip_photos_trip').on(t.trip)]);
