CREATE TABLE trip_audit_archive(trip TEXT NOT NULL,id TEXT NOT NULL,entry TEXT NOT NULL,PRIMARY KEY(trip,id));
--> statement-breakpoint
CREATE TABLE sync_meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
INSERT INTO sync_meta(key,value) VALUES('pruned_through',0);
