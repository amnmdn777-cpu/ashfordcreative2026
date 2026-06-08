CREATE TYPE "public"."approval_kind" AS ENUM('setup_fee_discount', 'free_first_month', 'refund_invoice', 'custom_addon_price');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"sale_id" integer,
	"rep_id" integer NOT NULL,
	"kind" "approval_kind" NOT NULL,
	"reason" text NOT NULL,
	"payload" jsonb,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"decided_by_rep_id" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_rep_id_sales_reps_id_fk" FOREIGN KEY ("decided_by_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "approval_requests_lead_idx" ON "approval_requests" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "approval_requests_rep_idx" ON "approval_requests" USING btree ("rep_id","created_at");