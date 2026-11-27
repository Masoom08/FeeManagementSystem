const { z } = require("zod");
const { idParams, isoDate } = require("../../lib/ids");
const { SEMESTER_NAMES } = require("../../lib/terms");

const registrationNumber = z
  .string({ required_error: "registrationNumber is required", invalid_type_error: "registrationNumber must be a string" })
  .trim()
  .min(1, "registrationNumber is required")
  .max(40, "registrationNumber must be at most 40 characters");

const personName = z
  .string({ required_error: "name is required", invalid_type_error: "name must be a string" })
  .trim()
  .min(1, "name is required")
  .max(120, "name must be at most 120 characters");

const phone = (field) =>
  z
    .string({ required_error: `${field} is required`, invalid_type_error: `${field} must be a string` })
    .trim()
    .regex(/^[1-9]\d{9}$/, `${field} must be a 10-digit number`);

const email = z
  .string({ required_error: "email is required", invalid_type_error: "email must be a string" })
  .trim()
  .email("email must be a valid email");

const admissionType = z.enum(["DIRECT", "COUNSELLING"], {
  errorMap: () => ({ message: "admissionType must be DIRECT or COUNSELLING" }),
});

const createStudentBody = z
  .object({
    registrationNumber,
    name: personName,
    whatsappNumber: phone("whatsappNumber"),
    phoneNumber: phone("phoneNumber"),
    email,
    fatherName: z.string().trim().min(1, "fatherName is required").max(120),
    branch: z.string().trim().min(1, "branch is required").max(80),
    courseId: z.number({ required_error: "courseId is required", invalid_type_error: "courseId must be an integer" }).int().positive(),
    batchId: z.number({ required_error: "batchId is required", invalid_type_error: "batchId must be an integer" }).int().positive(),
    sessionId: z.number({ required_error: "sessionId is required", invalid_type_error: "sessionId must be an integer" }).int().positive(),
    semesterId: z.number({ required_error: "semesterId is required", invalid_type_error: "semesterId must be an integer" }).int().positive(),
    admissionType,
    isHosteller: z.boolean({ invalid_type_error: "isHosteller must be a boolean" }).optional(),
    studyYear: z.number().int().positive("studyYear must be a positive integer").optional(),
  })
  .strict();

const updateStudentBody = z
  .object({
    registrationNumber: registrationNumber.optional(),
    name: personName.optional(),
    phoneNumber: phone("phoneNumber").optional(),
    whatsappNumber: phone("whatsappNumber").optional(),
    email: email.optional(),
    fatherName: z.string().trim().min(1, "fatherName is required").max(120).optional(),
    branch: z.string().trim().min(1, "branch is required").max(80).optional(),
    enrolmentNumber: z.string().trim().min(1, "enrolmentNumber is required").max(40).optional(),
    isHosteller: z.boolean({ invalid_type_error: "isHosteller must be a boolean" }).optional(),
    studyYear: z.number().int().positive("studyYear must be a positive integer").optional(),
    status: z.enum(["ACTIVE", "LEFT", "COMPLETED"], {
      errorMap: () => ({ message: "status must be ACTIVE, LEFT, or COMPLETED" }),
    }).optional(),
    leftOn: isoDate.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
    path: ["body"],
  });

const searchQuery = z
  .object({
    q: z.string().trim().optional(),
  })
  .strict();

const updateStudentYearBody = z.object({
  isHosteller: z.boolean(),
  hostelRateId: z.number().int().positive().nullable().optional(),
}).strict();
const academicYearParams = z.object({ id: z.coerce.number().int().positive(), sessionId: z.coerce.number().int().positive() }).strict();

const importRowSchema = z
  .object({
    registrationNumber,
    name: personName,
    whatsappNumber: phone("whatsappNumber"),
    phoneNumber: phone("phoneNumber"),
    email,
    fatherName: z.string().trim().min(1, "fatherName is required").max(120),
    branch: z.string().trim().min(1, "branch is required").max(80),
    courseCode: z.string().trim().min(1, "courseCode is required").max(20),
    admissionType,
    isHosteller: z.boolean({ invalid_type_error: "isHosteller must be a boolean" }),
    studyYear: z.number().int().positive("studyYear must be a positive integer"),
    batchLabel: z.string().trim().min(1, "batchLabel is required").max(20),
    sessionLabel: z.string().trim().min(1, "sessionLabel is required").max(20),
    semesterName: z.string().trim().min(1, "semesterName is required").max(40),
  })
  .strict();

module.exports = {
  createStudentBody,
  updateStudentBody,
  searchQuery,
  updateStudentYearBody,
  academicYearParams,
  importRowSchema,
  idParams: idParams(),
};
