const { z } = require("zod");

const courseCode = z
  .string({
    required_error: "courseCode is required",
    invalid_type_error: "courseCode must be a string",
  })
  .trim()
  .min(1, "courseCode is required")
  .max(20, "courseCode must be at most 20 characters");

const courseName = z
  .string({
    required_error: "courseName is required",
    invalid_type_error: "courseName must be a string",
  })
  .trim()
  .min(1, "courseName is required")
  .max(120, "courseName must be at most 120 characters");

const affiliation = z.enum(["AKTU", "LU"], {
  errorMap: () => ({ message: "affiliation must be AKTU or LU" }),
});

const lateFeePerDay = z
  .number({
    required_error: "lateFeePerDay is required",
    invalid_type_error: "lateFeePerDay must be an integer",
  })
  .int("lateFeePerDay must be an integer")
  .positive("lateFeePerDay must be a positive integer");

const durationYears = z
  .number({
    required_error: "durationYears is required",
    invalid_type_error: "durationYears must be an integer",
  })
  .int("durationYears must be an integer")
  .min(1, "durationYears must be at least 1")
  .max(6, "durationYears must be at most 6");

const createCourseBody = z
  .object({
    courseCode,
    courseName,
    affiliation,
    durationYears,
    lateFeePerDay,
    active: z.boolean({ invalid_type_error: "active must be a boolean" }).optional(),
  })
  .strict();

const updateCourseBody = z
  .object({
    courseCode: courseCode.optional(),
    courseName: courseName.optional(),
    affiliation: affiliation.optional(),
    durationYears: durationYears.optional(),
    lateFeePerDay: lateFeePerDay.optional(),
    active: z.boolean({ invalid_type_error: "active must be a boolean" }).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
    path: ["body"],
  });

const courseIdParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d*$/, "id must be a positive integer")
    .transform((value) => Number(value)),
});

module.exports = {
  createCourseBody,
  updateCourseBody,
  courseIdParams,
};
