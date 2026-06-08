CREATE TYPE "public"."user_role" AS ENUM('rep', 'admin');--> statement-breakpoint
CREATE TYPE "public"."disqualify_reason" AS ENUM('not_interested', 'wrong_number', 'do_not_call', 'already_has_provider', 'out_of_market', 'budget_concern', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('available', 'claimed', 'nurturing', 'won', 'disqualified', 'recycled');--> statement-breakpoint
CREATE TYPE "public"."link_event_type" AS ENUM('opened', 'viewed_template', 'preferred_template', 'requested_changes', 'requested_callback', 'payment_link_sent');--> statement-breakpoint
CREATE TYPE "public"."contact_request_status" AS ENUM('open', 'claimed', 'converted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."preferred_contact" AS ENUM('callback', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."plan_key" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'trialing', 'unpaid', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."custom_dev_status" AS ENUM('requested', 'quoted', 'sent', 'paid', 'declined');--> statement-breakpoint
CREATE TYPE "public"."client_onboarding_status" AS ENUM('pending', 'consent_recorded', 'content_collected', 'completed');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'received', 'dev_skipped');--> statement-breakpoint
CREATE TABLE "onboarding_acknowledgments" (
	"rep_id" integer NOT NULL,
	"section_key" varchar(64) NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_acknowledgments_rep_id_section_key_pk" PRIMARY KEY("rep_id","section_key")
);
--> statement-breakpoint
CREATE TABLE "sales_reps" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(128) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"role" "user_role" DEFAULT 'rep' NOT NULL,
	"promo_code" varchar(12) NOT NULL,
	"hourly_rate_cents" integer DEFAULT 2500 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_reps_username_unique" UNIQUE("username"),
	CONSTRAINT "sales_reps_promo_code_unique" UNIQUE("promo_code")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"practice" varchar(192) NOT NULL,
	"specialty" varchar(96) NOT NULL,
	"city" varchar(64) NOT NULL,
	"state" varchar(2) DEFAULT 'TX' NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(192),
	"current_website" varchar(256),
	"place_id" varchar(96),
	"profile_blurb" text,
	"status" "lead_status" DEFAULT 'available' NOT NULL,
	"claimed_by_rep_id" integer,
	"claimed_at" timestamp with time zone,
	"claim_expires_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"disqualify_reason" "disqualify_reason",
	"disqualify_note" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"event_type" "link_event_type" NOT NULL,
	"template_key" varchar(32),
	"change_request_text" text,
	"user_agent" varchar(256),
	"ip_hash" varchar(64),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"lead_id" integer NOT NULL,
	"rep_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "callback_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"rep_id" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"practice" varchar(192),
	"email" varchar(192),
	"phone" varchar(32),
	"preferred_contact" "preferred_contact" DEFAULT 'callback' NOT NULL,
	"message" text,
	"best_time_to_reach" varchar(96),
	"claimed_by_rep_id" integer,
	"status" "contact_request_status" DEFAULT 'open' NOT NULL,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"rep_id" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(192) NOT NULL,
	"body" text,
	"payload" jsonb,
	"link_url" varchar(256),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_name" varchar(96) NOT NULL,
	"author_practice" varchar(192),
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"title" varchar(256) NOT NULL,
	"excerpt" text NOT NULL,
	"body_md" text NOT NULL,
	"hero_image" varchar(256),
	"author_name" varchar(96) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"rep_id" integer,
	"lead_id" integer,
	"stripe_session_id" varchar(192),
	"stripe_customer_id" varchar(128),
	"plan_key" "plan_key" NOT NULL,
	"setup_amount_cents" integer DEFAULT 0 NOT NULL,
	"monthly_amount_cents" integer DEFAULT 14900 NOT NULL,
	"promo_code" varchar(12),
	"closing_bonus_cents" integer DEFAULT 10000 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_event_id" varchar(128) NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"stripe_subscription_id" varchar(192),
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"addon_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_total_cents" integer DEFAULT 14900 NOT NULL,
	"current_period_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_dev_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"sale_id" integer,
	"rep_id" integer NOT NULL,
	"feature_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_description" text,
	"status" "custom_dev_status" DEFAULT 'requested' NOT NULL,
	"quoted_amount_cents" integer,
	"admin_note" text,
	"stripe_payment_link_url" varchar(256),
	"stripe_payment_link_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_onboardings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"scrape_consent" integer DEFAULT 0,
	"scrape_consent_at" timestamp with time zone,
	"scrape_consent_ip" varchar(64),
	"content_json" jsonb,
	"content_collected_at" timestamp with time zone,
	"chosen_palette_key" varchar(32),
	"template_key" varchar(32),
	"selected_addons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_total_cents" integer DEFAULT 14900 NOT NULL,
	"status" "client_onboarding_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "client_onboardings_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" "message_direction" NOT NULL,
	"from_addr" varchar(192) NOT NULL,
	"to_addr" varchar(192) NOT NULL,
	"subject" varchar(256) NOT NULL,
	"body" text NOT NULL,
	"lead_id" integer,
	"rep_id" integer,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"resend_id" varchar(128),
	"in_reply_to_id" varchar(256),
	"error_message" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twilio_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" "message_direction" NOT NULL,
	"from_number" varchar(32) NOT NULL,
	"to_number" varchar(32) NOT NULL,
	"body" text NOT NULL,
	"lead_id" integer,
	"rep_id" integer,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"twilio_sid" varchar(128),
	"error_message" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_rep_id" integer,
	"action" varchar(96) NOT NULL,
	"target_type" varchar(64),
	"target_id" varchar(64),
	"diff" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_acknowledgments" ADD CONSTRAINT "onboarding_acknowledgments_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_claimed_by_rep_id_sales_reps_id_fk" FOREIGN KEY ("claimed_by_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_link_id_prospect_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."prospect_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_links" ADD CONSTRAINT "prospect_links_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_links" ADD CONSTRAINT "prospect_links_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_schedules" ADD CONSTRAINT "callback_schedules_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_schedules" ADD CONSTRAINT "callback_schedules_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_claimed_by_rep_id_sales_reps_id_fk" FOREIGN KEY ("claimed_by_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_dev_quotes" ADD CONSTRAINT "custom_dev_quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_dev_quotes" ADD CONSTRAINT "custom_dev_quotes_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_dev_quotes" ADD CONSTRAINT "custom_dev_quotes_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD CONSTRAINT "client_onboardings_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_messages" ADD CONSTRAINT "twilio_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_messages" ADD CONSTRAINT "twilio_messages_rep_id_sales_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_rep_id_sales_reps_id_fk" FOREIGN KEY ("actor_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_claimed_by_idx" ON "leads" USING btree ("claimed_by_rep_id");--> statement-breakpoint
CREATE INDEX "leads_city_idx" ON "leads" USING btree ("city");--> statement-breakpoint
CREATE INDEX "leads_phone_idx" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "link_events_link_idx" ON "link_events" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "prospect_links_lead_idx" ON "prospect_links" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "callbacks_rep_idx" ON "callback_schedules" USING btree ("rep_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "callbacks_lead_idx" ON "callback_schedules" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "notifications_rep_idx" ON "notifications" USING btree ("rep_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_comments_post_idx" ON "blog_comments" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_likes_post_fp_uniq" ON "blog_likes" USING btree ("post_id","fingerprint");--> statement-breakpoint
CREATE INDEX "sales_rep_idx" ON "sales" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "sales_lead_idx" ON "sales" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "email_messages_lead_idx" ON "email_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "twilio_messages_lead_idx" ON "twilio_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "twilio_messages_to_idx" ON "twilio_messages" USING btree ("to_number");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "admin_audit_log" USING btree ("actor_rep_id");