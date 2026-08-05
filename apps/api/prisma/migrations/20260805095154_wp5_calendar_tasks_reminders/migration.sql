-- CreateTable
CREATE TABLE `calendar_events` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `all_day` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('SCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `client_mutation_id` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `calendar_events_client_mutation_id_key`(`client_mutation_id`),
    INDEX `calendar_events_user_id_starts_at_idx`(`user_id`, `starts_at`),
    INDEX `calendar_events_user_id_status_deleted_at_idx`(`user_id`, `status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `status` ENUM('OPEN', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    `due_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `client_mutation_id` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tasks_client_mutation_id_key`(`client_mutation_id`),
    INDEX `tasks_user_id_status_idx`(`user_id`, `status`),
    INDEX `tasks_user_id_due_at_idx`(`user_id`, `due_at`),
    INDEX `tasks_user_id_status_deleted_at_idx`(`user_id`, `status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminders` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `note` VARCHAR(500) NULL,
    `target_type` ENUM('CALENDAR_EVENT', 'TASK', 'STANDALONE') NOT NULL DEFAULT 'STANDALONE',
    `target_id` VARCHAR(191) NULL,
    `schedule_type` ENUM('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL,
    `recurrence_json` JSON NULL,
    `status` ENUM('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED', 'SUPPRESSED') NOT NULL DEFAULT 'SCHEDULED',
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME(3) NULL,
    `last_attempt_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `suppressed_at` DATETIME(3) NULL,
    `failure_reason` VARCHAR(200) NULL,
    `last_error_code` VARCHAR(50) NULL,
    `client_mutation_id` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `reminders_client_mutation_id_key`(`client_mutation_id`),
    INDEX `reminders_user_id_status_scheduled_at_idx`(`user_id`, `status`, `scheduled_at`),
    INDEX `reminders_user_id_deleted_at_idx`(`user_id`, `deleted_at`),
    INDEX `reminders_status_scheduled_at_next_attempt_at_idx`(`status`, `scheduled_at`, `next_attempt_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
