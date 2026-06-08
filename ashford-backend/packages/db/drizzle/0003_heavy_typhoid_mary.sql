CREATE TABLE "sms_opt_outs" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(32) NOT NULL,
	"opted_out_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(32) DEFAULT 'inbound_keyword' NOT NULL,
	"keyword" varchar(32),
	CONSTRAINT "sms_opt_outs_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "closing_bonus_cents" SET DEFAULT 14900;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "accepted_terms_version" varchar(32);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "accepted_terms_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "accepted_terms_ip" varchar(64);--> statement-breakpoint
CREATE INDEX "sms_opt_outs_phone_idx" ON "sms_opt_outs" USING btree ("phone");