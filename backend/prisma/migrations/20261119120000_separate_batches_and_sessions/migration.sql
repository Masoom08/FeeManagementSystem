-- Preserve each student's cohort in its own course-specific batch record.
CREATE TABLE `batches` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `label` VARCHAR(20) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  UNIQUE INDEX `batches_course_id_label_key`(`course_id`, `label`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `students` ADD COLUMN `batch_id` INTEGER NULL;

INSERT INTO `batches` (`course_id`, `label`, `start_date`, `end_date`)
SELECT DISTINCT student.`course_id`,
  CONCAT(CAST(YEAR(session.`start_date`) AS CHAR), '-', LPAD(MOD(YEAR(session.`start_date`) + CASE WHEN LOWER(course.`course_name`) LIKE '%mba%' AND LOWER(course.`course_name`) NOT LIKE '%bba%' THEN 2 ELSE 3 END, 100), 2, '0')),
  session.`start_date`,
  STR_TO_DATE(CONCAT(YEAR(session.`start_date`) + CASE WHEN LOWER(course.`course_name`) LIKE '%mba%' AND LOWER(course.`course_name`) NOT LIKE '%bba%' THEN 2 ELSE 3 END, '-07-31'), '%Y-%m-%d')
FROM `students` student
JOIN `courses` course ON course.`id` = student.`course_id`
JOIN `academic_years` session ON session.`id` = student.`academic_year_id`;

UPDATE `students` student
JOIN `courses` course ON course.`id` = student.`course_id`
JOIN `academic_years` session ON session.`id` = student.`academic_year_id`
JOIN `batches` batch ON batch.`course_id` = student.`course_id`
  AND batch.`label` = (CONCAT(CAST(YEAR(session.`start_date`) AS CHAR), '-', LPAD(MOD(YEAR(session.`start_date`) + CASE WHEN LOWER(course.`course_name`) LIKE '%mba%' AND LOWER(course.`course_name`) NOT LIKE '%bba%' THEN 2 ELSE 3 END, 100), 2, '0')) COLLATE utf8mb4_unicode_ci)
SET student.`batch_id` = batch.`id`;

ALTER TABLE `students` MODIFY `batch_id` INTEGER NOT NULL;
ALTER TABLE `students` ADD INDEX `students_batch_id_idx`(`batch_id`);
ALTER TABLE `students` ADD CONSTRAINT `students_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `semesters` DROP FOREIGN KEY `semesters_academic_year_id_fkey`;
ALTER TABLE `fee_structures` DROP FOREIGN KEY `fee_structures_academic_year_id_fkey`;
ALTER TABLE `students` DROP FOREIGN KEY `students_academic_year_id_fkey`;
ALTER TABLE `fee_accounts` DROP FOREIGN KEY `fee_accounts_academic_year_id_fkey`;

RENAME TABLE `academic_years` TO `sessions`;
ALTER TABLE `sessions` DROP INDEX `academic_years_label_key`;
ALTER TABLE `sessions` ADD UNIQUE INDEX `sessions_label_key`(`label`);
ALTER TABLE `semesters` DROP INDEX `semesters_academic_year_id_name_key`;
ALTER TABLE `semesters` CHANGE COLUMN `academic_year_id` `session_id` INTEGER NOT NULL;
ALTER TABLE `fee_structures` ADD INDEX `fee_structures_course_id_idx`(`course_id`);
ALTER TABLE `fee_structures` DROP INDEX `fee_structures_course_id_academic_year_id_semester_id_compon_key`;
ALTER TABLE `fee_structures` CHANGE COLUMN `academic_year_id` `session_id` INTEGER NOT NULL;
ALTER TABLE `students` CHANGE COLUMN `academic_year_id` `session_id` INTEGER NOT NULL;
ALTER TABLE `fee_accounts` ADD INDEX `fee_accounts_student_id_idx`(`student_id`);
ALTER TABLE `fee_accounts` DROP INDEX `fee_accounts_student_id_product_academic_year_id_key`;
ALTER TABLE `fee_accounts` CHANGE COLUMN `academic_year_id` `session_id` INTEGER NOT NULL;

UPDATE `sessions`
SET `label` = CONCAT(CAST(YEAR(`start_date`) AS CHAR), '-', LPAD(MOD(YEAR(`start_date`) + 1, 100), 2, '0')),
    `end_date` = STR_TO_DATE(CONCAT(YEAR(`start_date`) + 1, '-07-31'), '%Y-%m-%d')
WHERE `label` REGEXP '^[0-9]{4}$';

INSERT INTO `sessions` (`label`, `start_date`, `end_date`)
SELECT targets.`label`, targets.`start_date`, targets.`end_date`
FROM (
  SELECT DISTINCT
    CONCAT(CAST(YEAR(base.`start_date`) + offsets.`offset_years` AS CHAR), '-', LPAD(MOD(YEAR(base.`start_date`) + offsets.`offset_years` + 1, 100), 2, '0')) AS `label`,
    STR_TO_DATE(CONCAT(YEAR(base.`start_date`) + offsets.`offset_years`, '-08-01'), '%Y-%m-%d') AS `start_date`,
    STR_TO_DATE(CONCAT(YEAR(base.`start_date`) + offsets.`offset_years` + 1, '-07-31'), '%Y-%m-%d') AS `end_date`
  FROM `sessions` base
  JOIN (SELECT 1 AS `offset_years` UNION ALL SELECT 2) offsets
) targets
LEFT JOIN `sessions` existing ON existing.`label` COLLATE utf8mb4_unicode_ci = targets.`label` COLLATE utf8mb4_unicode_ci
WHERE existing.`id` IS NULL;

-- The former academic-year row represented a whole student cohort. Move each
-- semester and its fee structure into the corresponding one-year session.
UPDATE `semesters` semester
JOIN `sessions` current_session ON current_session.`id` = semester.`session_id`
JOIN `sessions` target_session ON target_session.`label` = (CONCAT(
  CAST(YEAR(current_session.`start_date`) + FLOOR((CAST(SUBSTRING_INDEX(semester.`name`, ' ', -1) AS UNSIGNED) - 1) / 2) AS CHAR),
  '-',
  LPAD(MOD(YEAR(current_session.`start_date`) + FLOOR((CAST(SUBSTRING_INDEX(semester.`name`, ' ', -1) AS UNSIGNED) - 1) / 2) + 1, 100), 2, '0')
 ) COLLATE utf8mb4_unicode_ci)
SET semester.`session_id` = target_session.`id`;

UPDATE `fee_structures` structure
JOIN `semesters` semester ON semester.`id` = structure.`semester_id`
SET structure.`session_id` = semester.`session_id`;

-- A student's session is the session matching their current study year.
UPDATE `students` student
JOIN `batches` batch ON batch.`id` = student.`batch_id`
JOIN `sessions` target_session ON target_session.`label` = (CONCAT(
  CAST(CAST(SUBSTRING_INDEX(batch.`label`, '-', 1) AS UNSIGNED) + student.`study_year` - 1 AS CHAR),
  '-',
  LPAD(MOD(CAST(SUBSTRING_INDEX(batch.`label`, '-', 1) AS UNSIGNED) + student.`study_year`, 100), 2, '0')
 ) COLLATE utf8mb4_unicode_ci)
SET student.`session_id` = target_session.`id`;

UPDATE `fee_accounts` account
JOIN `students` student ON student.`id` = account.`student_id`
SET account.`session_id` = student.`session_id`;

ALTER TABLE `semesters` ADD UNIQUE INDEX `semesters_session_name_key`(`session_id`, `name`);
ALTER TABLE `fee_structures` ADD UNIQUE INDEX `fee_structures_session_key`(`course_id`, `session_id`, `semester_id`, `component`, `study_year`);
ALTER TABLE `fee_accounts` ADD UNIQUE INDEX `fee_accounts_student_product_session_key`(`student_id`, `product`, `session_id`);

ALTER TABLE `semesters` ADD CONSTRAINT `semesters_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `students` ADD CONSTRAINT `students_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fee_accounts` ADD CONSTRAINT `fee_accounts_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `batches` ADD CONSTRAINT `batches_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
