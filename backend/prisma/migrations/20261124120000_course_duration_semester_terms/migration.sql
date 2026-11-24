ALTER TABLE `courses` ADD COLUMN `duration_years` INTEGER NOT NULL DEFAULT 3;

UPDATE `courses` SET `duration_years` = 2 WHERE `course_code` IN ('MBA', 'MBAAK');

UPDATE `semesters` SET `name` = 'Ist Semester' WHERE `name` = 'Odd';
UPDATE `semesters` SET `name` = 'IInd Semester' WHERE `name` = 'Even';
