CREATE TABLE `student_otps` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `student_id` INTEGER NOT NULL,
  `phone_number` VARCHAR(20) NOT NULL,
  `otp_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `student_otps_phone_number_key`(`phone_number`),
  INDEX `student_otps_expires_at_idx`(`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `student_otps`
  ADD CONSTRAINT `student_otps_student_id_fkey`
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
