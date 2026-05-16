CREATE TABLE IF NOT EXISTS "kakeibo"."whatsapp_command_run" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "command" VARCHAR(80) NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'queued',
    "chat_id" VARCHAR(120) NOT NULL,
    "inbound_message_id" VARCHAR(255) NOT NULL,
    "outbound_ack_message_id" VARCHAR(255),
    "outbound_proposal_message_id" VARCHAR(255),
    "entity_type" VARCHAR(80),
    "entity_id" INTEGER,
    "media_path" VARCHAR(500),
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "whatsapp_command_run_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_command_run_inbound_message_id_key"
ON "kakeibo"."whatsapp_command_run"("inbound_message_id");

CREATE INDEX IF NOT EXISTS "whatsapp_command_run_chat_id_idx"
ON "kakeibo"."whatsapp_command_run"("chat_id");

CREATE INDEX IF NOT EXISTS "whatsapp_command_run_outbound_proposal_message_id_idx"
ON "kakeibo"."whatsapp_command_run"("outbound_proposal_message_id");

CREATE INDEX IF NOT EXISTS "whatsapp_command_run_entity_type_entity_id_idx"
ON "kakeibo"."whatsapp_command_run"("entity_type", "entity_id");
