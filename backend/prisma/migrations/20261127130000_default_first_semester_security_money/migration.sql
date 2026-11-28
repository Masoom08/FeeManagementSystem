INSERT IGNORE INTO `fee_structures`
  (`course_id`, `session_id`, `semester_id`, `component`, `study_year`, `amount`)
SELECT
  academic.`course_id`,
  academic.`session_id`,
  academic.`semester_id`,
  'ACADEMIC_CAUTION',
  academic.`study_year`,
  5000
FROM `fee_structures` AS academic
JOIN `semesters` AS semester ON semester.`id` = academic.`semester_id`
WHERE academic.`component` = 'ACADEMIC_FEE'
  AND academic.`study_year` = 1
  AND (semester.`name` = 'Semester 1' OR semester.`name` = 'Ist Semester');
