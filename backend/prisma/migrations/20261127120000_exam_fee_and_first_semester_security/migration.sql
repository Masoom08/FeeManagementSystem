ALTER TABLE `fee_structures`
  MODIFY `component` ENUM('ACADEMIC_FEE', 'EXAM_FEE', 'ACADEMIC_CAUTION', 'HOSTEL_FEE', 'HOSTEL_SECURITY') NOT NULL;

ALTER TABLE `ledger_entries`
  MODIFY `component` ENUM('ACADEMIC_FEE', 'EXAM_FEE', 'ACADEMIC_CAUTION', 'HOSTEL_FEE', 'HOSTEL_SECURITY') NOT NULL;

INSERT IGNORE INTO `fee_structures`
  (`course_id`, `session_id`, `semester_id`, `component`, `study_year`, `amount`)
SELECT
  academic.`course_id`,
  academic.`session_id`,
  academic.`semester_id`,
  'EXAM_FEE',
  academic.`study_year`,
  1000
FROM `fee_structures` AS academic
JOIN `semesters` AS semester ON semester.`id` = academic.`semester_id`
WHERE academic.`component` = 'ACADEMIC_FEE'
  AND (
    (semester.`name` REGEXP '^Semester [0-9]+$'
      AND MOD(CAST(SUBSTRING_INDEX(semester.`name`, ' ', -1) AS UNSIGNED), 2) = 1)
    OR semester.`name` = 'Ist Semester'
  );
