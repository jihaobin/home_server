CREATE TABLE "chat_blocks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"blocker_user_id" varchar(255) NOT NULL,
	"blocked_user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_blocks_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"worker_user_id" varchar(255) NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_conversations_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"sender_user_id" varchar(255) NOT NULL,
	"content" jsonb NOT NULL,
	"client_msg_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "chat_reports" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"reporter_user_id" varchar(255) NOT NULL,
	"reported_user_id" varchar(255) NOT NULL,
	"message_id" varchar(255),
	"reason" varchar(200) NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_reports_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_blocks_blocker_blocked_unique" ON "chat_blocks" USING btree ("blocker_user_id","blocked_user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_blocks_blocker_time" ON "chat_blocks" USING btree ("blocker_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_user_worker_unique" ON "chat_conversations" USING btree ("user_id","worker_user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_user_last_message" ON "chat_conversations" USING btree ("user_id","last_message_at" DESC NULLS LAST,"updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_worker_last_message" ON "chat_conversations" USING btree ("worker_user_id","last_message_at" DESC NULLS LAST,"updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_conversation_time" ON "chat_messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_idempotency_unique" ON "chat_messages" USING btree ("conversation_id","sender_user_id","client_msg_id") WHERE client_msg_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_chat_reports_status_time" ON "chat_reports" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chat_reports_reporter_time" ON "chat_reports" USING btree ("reporter_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chat_reports_reported_time" ON "chat_reports" USING btree ("reported_user_id","created_at" DESC NULLS LAST);