-- CreateTable
CREATE TABLE `academic_years` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(20) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,

    UNIQUE INDEX `academic_years_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semesters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academic_year_id` INTEGER NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `due_date` DATE NOT NULL,
    `grace_days` INTEGER NOT NULL,
    `fine_end_date` DATE NULL,

    UNIQUE INDEX `semesters_academic_year_id_name_key`(`academic_year_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_structures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `academic_year_id` INTEGER NOT NULL,
    `semester_id` INTEGER NOT NULL,
    `component` ENUM('ACADEMIC_FEE', 'ACADEMIC_CAUTION', 'HOSTEL_FEE', 'HOSTEL_SECURITY') NOT NULL,
    `study_year` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,

    UNIQUE INDEX `fee_structures_course_id_academic_year_id_semester_id_compon_key`(`course_id`, `academic_year_id`, `semester_id`, `component`, `study_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registration_number` VARCHAR(40) NOT NULL,
    `enrolment_number` VARCHAR(40) NULL,
    `name` VARCHAR(120) NOT NULL,
    `whatsapp_number` VARCHAR(20) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `father_name` VARCHAR(120) NOT NULL,
    `branch` VARCHAR(80) NOT NULL,
    `course_id` INTEGER NOT NULL,
    `academic_year_id` INTEGER NOT NULL,
    `admission_semester_id` INTEGER NOT NULL,
    `admission_type` ENUM('DIRECT', 'COUNSELLING') NOT NULL,
    `is_hosteller` BOOLEAN NOT NULL DEFAULT false,
    `study_year` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'LEFT', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `left_on` DATE NULL,

    UNIQUE INDEX `students_registration_number_key`(`registration_number`),
    UNIQUE INDEX `students_enrolment_number_key`(`enrolment_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `product` ENUM('ACADEMIC', 'HOSTEL') NOT NULL,
    `academic_year_id` INTEGER NOT NULL,

    UNIQUE INDEX `fee_accounts_student_id_product_academic_year_id_key`(`student_id`, `product`, `academic_year_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fee_account_id` INTEGER NOT NULL,
    `semester_id` INTEGER NULL,
    `bucket` ENUM('DUES', 'DEPOSIT') NOT NULL,
    `entry_type` ENUM('ASSESSMENT', 'PAYMENT', 'FINE', 'WAIVER', 'REFUND', 'ADJUSTMENT', 'DEDUCTION') NOT NULL,
    `direction` ENUM('INCREASE', 'DECREASE') NOT NULL,
    `amount` INTEGER NOT NULL,
    `component` ENUM('ACADEMIC_FEE', 'ACADEMIC_CAUTION', 'HOSTEL_FEE', 'HOSTEL_SECURITY') NOT NULL,
    `effective_date` DATE NOT NULL,
    `acted_by` VARCHAR(80) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `related_entry_id` INTEGER NULL,
    `payment_attempt_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `method` ENUM('HDFC', 'CHALLAN', 'CASH') NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL,
    `amount` INTEGER NOT NULL,
    `reference` VARCHAR(80) NULL,
    `idempotency_key` VARCHAR(80) NOT NULL,
    `receipt_no` VARCHAR(40) NULL,
    `acted_by` VARCHAR(80) NULL,
    `paid_on` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_attempts_reference_key`(`reference`),
    UNIQUE INDEX `payment_attempts_idempotency_key_key`(`idempotency_key`),
    UNIQUE INDEX `payment_attempts_receipt_no_key`(`receipt_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_attempt_id` INTEGER NOT NULL,
    `fee_account_id` INTEGER NOT NULL,
    `bucket` ENUM('DUES', 'DEPOSIT') NOT NULL,
    `amount` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PREVIEW', 'COMMITTED') NOT NULL DEFAULT 'PREVIEW',
    `file_name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `import_batch_id` INTEGER NOT NULL,
    `row_number` INTEGER NOT NULL,
    `valid` BOOLEAN NOT NULL,
    `errors` JSON NULL,
    `payload` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `channel` ENUM('SMS', 'WHATSAPP') NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acted_by` VARCHAR(80) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `semesters` ADD CONSTRAINT `semesters_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_admission_semester_id_fkey` FOREIGN KEY (`admission_semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_accounts` ADD CONSTRAINT `fee_accounts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_accounts` ADD CONSTRAINT `fee_accounts_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_fee_account_id_fkey` FOREIGN KEY (`fee_account_id`) REFERENCES `fee_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_related_entry_id_fkey` FOREIGN KEY (`related_entry_id`) REFERENCES `ledger_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_payment_attempt_id_fkey` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_attempt_id_fkey` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_fee_account_id_fkey` FOREIGN KEY (`fee_account_id`) REFERENCES `fee_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_rows` ADD CONSTRAINT `import_rows_import_batch_id_fkey` FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
