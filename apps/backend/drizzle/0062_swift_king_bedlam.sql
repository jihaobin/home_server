CREATE TABLE "chat_conversation_user_states" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"last_read_message_id" varchar(255),
	"last_read_at" timestamp with time zone,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_conversation_user_states_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "last_message_id" varchar(255);--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "last_message_sender_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "last_message_type" varchar(64);--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "last_message_preview_text" varchar(512);--> statement-breakpoint
ALTER TABLE "chat_conversation_user_states" ADD CONSTRAINT "chat_conversation_user_states_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_user_states" ADD CONSTRAINT "chat_conversation_user_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation_user_states" ADD CONSTRAINT "chat_conversation_user_states_last_read_message_id_chat_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversation_user_states_conversation_user_unique" ON "chat_conversation_user_states" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_state_user_updated" ON "chat_conversation_user_states" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chat_state_conversation" ON "chat_conversation_user_states" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_last_message_sender_user_id_users_id_fk" FOREIGN KEY ("last_message_sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;