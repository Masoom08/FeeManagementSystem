CREATE TABLE `student_years` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `student_id` INTEGER NOT NULL,
  `session_id` INTEGER NOT NULL,
  `study_year` INTEGER NOT NULL,
  `is_hosteller` BOOLEAN NOT NULL DEFAULT false,
  `hostel_rate_id` INTEGER NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `student_years_student_id_session_id_key` (`student_id`, `session_id`),
  INDEX `student_years_session_id_is_hosteller_idx` (`session_id`, `is_hosteller`),
  CONSTRAINT `student_years_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_years_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `student_years_hostel_rate_id_fkey` FOREIGN KEY (`hostel_rate_id`) REFERENCES `hostel_rates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO `student_years` (`student_id`, `session_id`, `study_year`, `is_hosteller`, `hostel_rate_id`)
SELECT st.`id`, se.`id`, YEAR(se.`start_date`) - YEAR(bt.`start_date`) + 1,
       IF(se.`id` = st.`session_id`, st.`is_hosteller`, false),
       IF(se.`id` = st.`session_id`, st.`hostel_rate_id`, NULL)
FROM `students` st
JOIN `batches` bt ON bt.`id` = st.`batch_id`
JOIN `courses` c ON c.`id` = st.`course_id`
JOIN `sessions` current_session ON current_session.`id` = st.`session_id`
JOIN `sessions` se ON se.`start_date` >= bt.`start_date` AND se.`start_date` <= current_session.`start_date`
WHERE YEAR(se.`start_date`) - YEAR(bt.`start_date`) BETWEEN 0 AND c.`duration_years` - 1;
