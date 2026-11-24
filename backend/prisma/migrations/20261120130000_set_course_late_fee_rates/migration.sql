UPDATE `courses`
SET `late_fee_per_day` = CASE
  WHEN LOWER(`course_name`) LIKE '%mba%'
    OR LOWER(`course_name`) LIKE '%master%'
    OR LOWER(`course_name`) LIKE '%pg %'
  THEN 10
  ELSE 5
END
WHERE LOWER(`course_name`) LIKE '%b.com%'
   OR LOWER(`course_name`) LIKE '%bba%'
   OR LOWER(`course_name`) LIKE '%mba%'
   OR LOWER(`course_name`) LIKE '%master%'
   OR LOWER(`course_name`) LIKE '%pg %';
