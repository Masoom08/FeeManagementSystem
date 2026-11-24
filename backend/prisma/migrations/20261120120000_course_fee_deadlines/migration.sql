CREATE TABLE `course_fee_deadlines` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `semester_type` VARCHAR(10) NOT NULL,
  `month` INTEGER NOT NULL,
  `day` INTEGER NOT NULL,
  UNIQUE INDEX `course_fee_deadlines_course_semester_key`(`course_id`, `semester_type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `course_fee_deadlines`
  ADD CONSTRAINT `course_fee_deadlines_course_id_fkey`
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `course_fee_deadlines` (`course_id`, `semester_type`, `month`, `day`)
SELECT `id`, 'ODD', CASE WHEN LOWER(`course_name`) LIKE '%mba%' AND LOWER(`course_name`) NOT LIKE '%bba%' THEN 5 ELSE 6 END, 10
FROM `courses`
WHERE LOWER(`course_name`) LIKE '%b.com%' OR LOWER(`course_name`) LIKE '%bba%' OR (LOWER(`course_name`) LIKE '%mba%' AND LOWER(`course_name`) NOT LIKE '%bba%');

INSERT INTO `course_fee_deadlines` (`course_id`, `semester_type`, `month`, `day`)
SELECT `id`, 'EVEN', CASE WHEN LOWER(`course_name`) LIKE '%mba%' AND LOWER(`course_name`) NOT LIKE '%bba%' THEN 11 ELSE 1 END, 10
FROM `courses`
WHERE LOWER(`course_name`) LIKE '%b.com%' OR LOWER(`course_name`) LIKE '%bba%' OR (LOWER(`course_name`) LIKE '%mba%' AND LOWER(`course_name`) NOT LIKE '%bba%');
