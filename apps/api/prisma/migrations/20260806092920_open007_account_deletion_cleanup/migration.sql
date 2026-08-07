-- AlterTable
ALTER TABLE `users` ADD COLUMN `deletion_attempt_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `deletion_completed_at` DATETIME(3) NULL,
    ADD COLUMN `deletion_last_error` VARCHAR(500) NULL,
    ADD COLUMN `deletion_lease_expires_at` DATETIME(3) NULL,
    ADD COLUMN `deletion_scheduled_at` DATETIME(3) NULL,
    ADD COLUMN `deletion_started_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('ACTIVE', 'SUSPENDED', 'CLOSED', 'DELETION_PENDING', 'DELETION_PROCESSING', 'DELETED') NOT NULL DEFAULT 'ACTIVE';

-- Backfill planned deletion time for pre-existing pending deletions (30-day default).
UPDATE `users`
SET `deletion_scheduled_at` = COALESCE(
  `deletion_scheduled_at`,
  DATE_ADD(COALESCE(`deletion_requested_at`, `created_at`), INTERVAL 30 DAY)
)
WHERE `status` = 'DELETION_PENDING';
