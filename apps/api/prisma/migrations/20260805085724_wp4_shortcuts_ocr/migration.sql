-- CreateTable
CREATE TABLE `device_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `token_prefix` VARCHAR(8) NOT NULL,
    `scopes` JSON NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `device_credentials_token_hash_key`(`token_hash`),
    INDEX `device_credentials_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    INDEX `device_credentials_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `owner_type` ENUM('TRANSACTION_DRAFT') NOT NULL,
    `owner_id` VARCHAR(191) NULL,
    `object_key` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` VARCHAR(64) NULL,
    `scan_status` ENUM('PENDING', 'SCANNED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `upload_token_hash` VARCHAR(64) NULL,
    `upload_intent_expires_at` DATETIME(3) NULL,
    `content_stored_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `attachments_object_key_key`(`object_key`),
    UNIQUE INDEX `attachments_upload_token_hash_key`(`upload_token_hash`),
    INDEX `attachments_user_id_owner_type_owner_id_idx`(`user_id`, `owner_type`, `owner_id`),
    INDEX `attachments_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `draft_records` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `source` ENUM('MANUAL', 'SHORTCUT', 'OCR', 'TEXT', 'VOICE', 'IMPORT') NOT NULL,
    `target_type` ENUM('TRANSACTION') NOT NULL,
    `payload_json` JSON NOT NULL,
    `confidence_json` JSON NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'DISCARDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `client_mutation_id` VARCHAR(191) NULL,
    `attachment_id` VARCHAR(191) NULL,
    `failure_reason` VARCHAR(200) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `confirmed_at` DATETIME(3) NULL,
    `discarded_at` DATETIME(3) NULL,
    `result_id` VARCHAR(191) NULL,

    UNIQUE INDEX `draft_records_client_mutation_id_key`(`client_mutation_id`),
    INDEX `draft_records_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    INDEX `draft_records_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `device_credentials` ADD CONSTRAINT `device_credentials_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `draft_records` ADD CONSTRAINT `draft_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `draft_records` ADD CONSTRAINT `draft_records_attachment_id_fkey` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
