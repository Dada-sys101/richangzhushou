-- CreateTable
CREATE TABLE `reminder_recurrence_rules` (
    `id` VARCHAR(191) NOT NULL,
    `reminder_id` VARCHAR(191) NOT NULL,
    `engine` ENUM('RRULE_TEMPORAL') NOT NULL DEFAULT 'RRULE_TEMPORAL',
    `schema_version` SMALLINT NOT NULL DEFAULT 1,
    `rrule_text` TEXT NOT NULL,
    `time_zone_id` VARCHAR(64) NOT NULL,
    `time_mode` ENUM('WALL_CLOCK', 'ABSOLUTE_INSTANT') NOT NULL DEFAULT 'WALL_CLOCK',
    `dtstart_local` DATETIME(3) NULL,
    `dtstart_instant` DATETIME(3) NOT NULL,
    `canonical_hash` CHAR(64) NOT NULL,
    `parent_rule_id` VARCHAR(191) NULL,
    `split_from_occurrence_key` VARCHAR(128) NULL,
    `backfill_status` ENUM('NOT_REQUIRED', 'PENDING', 'COMPLETED', 'MISMATCH', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `backfilled_at` DATETIME(3) NULL,
    `dual_read_verified_at` DATETIME(3) NULL,
    `parity_mismatch_count` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rrule_reminder_id_key`(`reminder_id`),
    INDEX `rrule_parent_rule_id_idx`(`parent_rule_id`),
    INDEX `rrule_backfill_status_idx`(`backfill_status`),
    INDEX `rrule_time_zone_id_idx`(`time_zone_id`),
    INDEX `rrule_dual_read_verified_at_idx`(`dual_read_verified_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder_recurrence_exceptions` (
    `id` VARCHAR(191) NOT NULL,
    `recurrence_rule_id` VARCHAR(191) NOT NULL,
    `occurrence_key` VARCHAR(128) NOT NULL,
    `original_occurrence_at` DATETIME(3) NOT NULL,
    `exception_type` ENUM('CANCEL', 'REPLACE') NOT NULL,
    `replacement_local_at` DATETIME(3) NULL,
    `replacement_instant_at` DATETIME(3) NULL,
    `replacement_time_zone_id` VARCHAR(64) NULL,
    `replacement_payload_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rrule_exception_occurrence_key`(`recurrence_rule_id`, `occurrence_key`),
    INDEX `rrule_exception_original_at_idx`(`recurrence_rule_id`, `original_occurrence_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reminder_recurrence_rules` ADD CONSTRAINT `rrule_reminder_id_fkey` FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder_recurrence_rules` ADD CONSTRAINT `rrule_parent_rule_id_fkey` FOREIGN KEY (`parent_rule_id`) REFERENCES `reminder_recurrence_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder_recurrence_exceptions` ADD CONSTRAINT `rrule_exception_rule_id_fkey` FOREIGN KEY (`recurrence_rule_id`) REFERENCES `reminder_recurrence_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
