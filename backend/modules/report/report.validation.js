const { z } = require("zod");
const { idSchema, isoDate } = require("../../lib/ids");

const optionalCourseId = idSchema("courseId").optional();

const paymentsQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    courseId: optionalCourseId,
    format: z.enum(["json", "xlsx"]).optional(),
  })
  .strict();

const courseQuery = z
  .object({
    courseId: optionalCourseId,
  })
  .strict();

const semesterQuery = z
  .object({
    semesterId: idSchema("semesterId"),
  })
  .strict();

module.exports = {
  paymentsQuery,
  courseQuery,
  semesterQuery,
};
