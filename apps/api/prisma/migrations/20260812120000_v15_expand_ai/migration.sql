-- CreateTable
CREATE TABLE `ai_requests` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(100) NOT NULL,
    `idempotency_key` VARCHAR(200) NOT NULL,
    `input_fingerprint` CHAR(64) NOT NULL,
    `locale` VARCHAR(20) NOT NULL,
    `time_zone_id` VARCHAR(64) NOT NULL,
    `status` ENUM('CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL,
    `proposal_id` VARCHAR(191) NULL,
    `failure_category` VARCHAR(50) NULL,
    `failure_code` VARCHAR(100) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_requests_idempotency_key_key`(`idempotency_key`),
    INDEX `ai_requests_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_proposals` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `ai_request_id` VARCHAR(191) NOT NULL,
    `source_draft_id` VARCHAR(191) NULL,
    `provider_id` VARCHAR(80) NOT NULL,
    `model_id` VARCHAR(120) NOT NULL,
    `status` ENUM('PENDING_REVIEW', 'PARTIALLY_APPLIED', 'APPLIED', 'REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED') NOT NULL,
    `schema_version` SMALLINT NOT NULL,
    `response_fingerprint` CHAR(64) NOT NULL,
    `usage_json` JSON NULL,
    `expires_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_proposals_ai_request_id_key`(`ai_request_id`),
    INDEX `ai_proposals_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    INDEX `ai_proposals_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_operations` (
    `id` VARCHAR(191) NOT NULL,
    `proposal_id` VARCHAR(191) NOT NULL,
    `ordinal` SMALLINT NOT NULL,
    `operation_type` ENUM('TRANSACTION', 'CALENDAR_EVENT', 'TASK', 'REMINDER', 'TRIP') NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED', 'FAILED', 'EXPIRED') NOT NULL,
    `confidence` DECIMAL(5, 4) NOT NULL,
    `fields_json` JSON NOT NULL,
    `fields_fingerprint` CHAR(64) NOT NULL,
    `clarification` VARCHAR(500) NULL,
    `result_entity_type` VARCHAR(50) NULL,
    `result_entity_id` VARCHAR(191) NULL,
    `result_draft_id` VARCHAR(191) NULL,
    `error_code` VARCHAR(100) NULL,
    `error_message` VARCHAR(500) NULL,
    `accepted_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_operations_proposal_id_ordinal_key`(`proposal_id`, `ordinal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_provider_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `ai_request_id` VARCHAR(191) NOT NULL,
    `attempt_no` SMALLINT NOT NULL,
    `provider_id` VARCHAR(80) NOT NULL,
    `model_id` VARCHAR(120) NULL,
    `status` ENUM('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL,
    `failure_category` VARCHAR(50) NULL,
    `http_status` SMALLINT NULL,
    `latency_ms` INTEGER NULL,
    `input_tokens` INTEGER NULL,
    `output_tokens` INTEGER NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    INDEX `ai_provider_attempts_started_at_idx`(`started_at`),
    UNIQUE INDEX `ai_provider_attempts_ai_request_id_attempt_no_key`(`ai_request_id`, `attempt_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_requests` ADD CONSTRAINT `ai_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_proposals` ADD CONSTRAINT `ai_proposals_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_proposals` ADD CONSTRAINT `ai_proposals_ai_request_id_fkey` FOREIGN KEY (`ai_request_id`) REFERENCES `ai_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_proposals` ADD CONSTRAINT `ai_proposals_source_draft_id_fkey` FOREIGN KEY (`source_draft_id`) REFERENCES `draft_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_operations` ADD CONSTRAINT `ai_operations_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `ai_proposals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_operations` ADD CONSTRAINT `ai_operations_result_draft_id_fkey` FOREIGN KEY (`result_draft_id`) REFERENCES `draft_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_provider_attempts` ADD CONSTRAINT `ai_provider_attempts_ai_request_id_fkey` FOREIGN KEY (`ai_request_id`) REFERENCES `ai_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
