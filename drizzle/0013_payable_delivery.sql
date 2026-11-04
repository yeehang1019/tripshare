CREATE TABLE payable_delivery(id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,delivered INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',lease TEXT NOT NULL DEFAULT '',lock_until INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
INSERT INTO payable_delivery(id) VALUES('payables');