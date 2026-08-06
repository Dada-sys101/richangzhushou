-- AlterTable
ALTER TABLE `budgets` ADD COLUMN `client_mutation_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `categories` ADD COLUMN `client_mutation_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `financial_accounts` ADD COLUMN `client_mutation_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `sync_mutations` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `client_mutation_id` VARCHAR(191) NOT NULL,
    `entity_type` ENUM('TRANSACTION', 'CATEGORY', 'FINANCIAL_ACCOUNT', 'BUDGET', 'CALENDAR_EVENT', 'TASK', 'REMINDER', 'TRIP', 'TRIP_ITEM', 'PACKING_ITEM', 'DRAFT_RECORD') NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE') NOT NULL,
    `request_hash` VARCHAR(64) NOT NULL,
    `result_ref` JSON NULL,
    `status` ENUM('APPLIED', 'CONFLICTED', 'FAILED') NOT NULL DEFAULT 'FAILED',
    `error_code` VARCHAR(50) NULL,
    `error_message` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sync_mutations_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `sync_mutations_user_id_status_idx`(`user_id`, `status`),
    UNIQUE INDEX `sync_mutations_user_id_client_mutation_id_key`(`user_id`, `client_mutation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `budgets_client_mutation_id_key` ON `budgets`(`client_mutation_id`);

-- CreateIndex
CREATE INDEX `budgets_user_id_updated_at_idx` ON `budgets`(`user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `calendar_events_user_id_updated_at_idx` ON `calendar_events`(`user_id`, `updated_at`);

-- CreateIndex
CREATE UNIQUE INDEX `categories_client_mutation_id_key` ON `categories`(`client_mutation_id`);

-- CreateIndex
CREATE INDEX `categories_user_id_updated_at_idx` ON `categories`(`user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `draft_records_user_id_updated_at_idx` ON `draft_records`(`user_id`, `updated_at`);

-- CreateIndex
CREATE UNIQUE INDEX `financial_accounts_client_mutation_id_key` ON `financial_accounts`(`client_mutation_id`);

-- CreateIndex
CREATE INDEX `financial_accounts_user_id_updated_at_idx` ON `financial_accounts`(`user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `packing_items_trip_id_updated_at_idx` ON `packing_items`(`trip_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `reminders_user_id_updated_at_idx` ON `reminders`(`user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `tasks_user_id_updated_at_idx` ON `tasks`(`user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `transactions_user_id_updated_at_idx` ON `transactions`(`user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `trip_items_trip_id_updated_at_idx` ON `trip_items`(`trip_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `trips_user_id_updated_at_idx` ON `trips`(`user_id`, `updated_at`);

-- AddForeignKey
ALTER TABLE `sync_mutations` ADD CONSTRAINT `sync_mutations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
