-- AlterTable
ALTER TABLE `ai_requests`
    ADD COLUMN `original_user_input` VARCHAR(2000) NULL,
    ADD COLUMN `original_input_expires_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `ai_requests_original_input_expires_at_idx` ON `ai_requests`(`original_input_expires_at`);
