-- CreateTable
CREATE TABLE `courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_code` VARCHAR(20) NOT NULL,
    `course_name` VARCHAR(120) NOT NULL,
    `affiliation` ENUM('AKTU', 'LU') NOT NULL,
    `late_fee_per_day` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `courses_course_code_key`(`course_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
