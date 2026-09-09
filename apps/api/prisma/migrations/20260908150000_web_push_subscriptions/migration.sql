CREATE TABLE `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `endpoint_hash` CHAR(64) NOT NULL,
    `endpoint_ciphertext` TEXT NOT NULL,
    `p256dh_ciphertext` TEXT NOT NULL,
    `auth_ciphertext` TEXT NOT NULL,
    `encryption_key_version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED', 'INVALID') NOT NULL DEFAULT 'ACTIVE',
    `failure_count` INTEGER NOT NULL DEFAULT 0,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NULL,

    UNIQUE INDEX `push_subscriptions_endpoint_hash_key`(`endpoint_hash`),
    INDEX `push_subscriptions_user_id_updated_at_idx`(`user_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `push_subscriptions`
    ADD CONSTRAINT `push_subscriptions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `push_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NULL,
    `reminder_id` VARCHAR(191) NULL,
    `idempotency_key` VARCHAR(200) NOT NULL,
    `payload_fingerprint` CHAR(64) NOT NULL,
    `deep_link` VARCHAR(500) NULL,
    `status` ENUM('QUEUED', 'SENDING', 'ACCEPTED_BY_PUSH_SERVICE', 'RETRY_SCHEDULED', 'EXPIRED_SUBSCRIPTION', 'PERMANENT_FAILURE') NOT NULL DEFAULT 'QUEUED',
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `last_attempt_at` DATETIME(3) NULL,
    `accepted_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `http_status` SMALLINT NULL,
    `failure_category` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `push_deliveries_idempotency_key_key`(`idempotency_key`),
    INDEX `push_deliveries_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
    INDEX `push_deliveries_reminder_id_idx`(`reminder_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `push_deliveries`
    ADD CONSTRAINT `push_deliveries_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `push_deliveries_subscription_id_fkey`
    FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
