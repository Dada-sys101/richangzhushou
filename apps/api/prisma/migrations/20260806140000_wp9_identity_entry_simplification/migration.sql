-- DropForeignKey
ALTER TABLE `invite_codes` DROP FOREIGN KEY `invite_codes_created_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `invite_codes` DROP FOREIGN KEY `invite_codes_revoked_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `invite_redemptions` DROP FOREIGN KEY `invite_redemptions_invite_id_fkey`;

-- DropForeignKey
ALTER TABLE `invite_redemptions` DROP FOREIGN KEY `invite_redemptions_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `recovery_codes` DROP FOREIGN KEY `recovery_codes_user_id_fkey`;

-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- DropIndex
DROP INDEX `users_normalized_email_key` ON `users`;

-- AlterTable
ALTER TABLE `attachments` DROP COLUMN `scan_status`;

-- AlterTable
ALTER TABLE `draft_records` MODIFY `source` ENUM('MANUAL', 'SHORTCUT', 'TEXT', 'VOICE', 'IMPORT') NOT NULL;

-- AlterTable
ALTER TABLE `system_settings` DROP COLUMN `invite_required`,
    DROP COLUMN `registration_enabled`;

-- AlterTable
ALTER TABLE `transactions` MODIFY `source` ENUM('MANUAL', 'SHORTCUT', 'TEXT', 'VOICE', 'IMPORT') NOT NULL DEFAULT 'MANUAL';

-- AlterTable: add username columns as nullable first so existing rows can be backfilled.
ALTER TABLE `users`
    ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `normalized_username` VARCHAR(191) NULL,
    ADD COLUMN `username` VARCHAR(191) NULL;

-- Backfill username from the sanitized email local part (kept below 32 chars).
UPDATE `users`
SET `username` = IF(
    REGEXP_REPLACE(LOWER(SUBSTRING_INDEX(`email`, '@', 1)), '[^a-z0-9_]', '') = '',
    'user',
    LEFT(REGEXP_REPLACE(LOWER(SUBSTRING_INDEX(`email`, '@', 1)), '[^a-z0-9_]', ''), 20)
)
WHERE `username` IS NULL;

-- Resolve backfill collisions deterministically by appending a row number suffix.
UPDATE `users` u
JOIN (
    SELECT
        t.id,
        ROW_NUMBER() OVER (PARTITION BY t.base ORDER BY t.id) AS rn
    FROM (
        SELECT id, LOWER(LEFT(REGEXP_REPLACE(SUBSTRING_INDEX(`email`, '@', 1), '[^a-z0-9_]', ''), 20)) AS base
        FROM `users`
    ) t
) x ON x.id = u.id
SET u.`username` = IF(
    x.rn = 1,
    u.`username`,
    CONCAT(LEFT(u.`username`, 20), '_', x.rn)
)
WHERE x.rn > 1;

UPDATE `users`
SET `normalized_username` = LOWER(`username`)
WHERE `normalized_username` IS NULL;

-- Make the new columns required, then remove the email columns.
ALTER TABLE `users`
    MODIFY `username` VARCHAR(191) NOT NULL,
    MODIFY `normalized_username` VARCHAR(191) NOT NULL;

ALTER TABLE `users`
    DROP COLUMN `email`,
    DROP COLUMN `normalized_email`;

-- DropTable
DROP TABLE `invite_codes`;

-- DropTable
DROP TABLE `invite_redemptions`;

-- DropTable
DROP TABLE `recovery_codes`;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

-- CreateIndex
CREATE UNIQUE INDEX `users_normalized_username_key` ON `users`(`normalized_username`);
