const { z } = require("zod");
const { actedBy, idParams, isoDate, positiveAmount } = require("../../lib/ids");
const { SEMESTER_NAMES } = require("../../lib/terms");

const label = z.string().trim().min(1, "label is required").max(20, "label must be at most 20 characters");
const name = z.enum(SEMESTER_NAMES, {
  errorMap: () => ({ message: "name must be Ist Semester or IInd Semester" }),
});

const createAcademicYearBody = z
  .object({
    label,
    startDate: isoDate,
    endDate: isoDate,
  })
  .strict();

const createSemesterBody = z
  .object({
    academicYearId: z.number().int().positive(),
    name,
    dueDate: isoDate,
    graceDays: z.number().int().min(0, "graceDays must be zero or greater"),
    fineEndDate: isoDate.optional(),
  })
  .strict();

const createFeeStructureBody = z
  .object({
    courseId: z.number().int().positive(),
    academicYearId: z.number().int().positive(),
    semesterId: z.number().int().positive(),
    component: z.enum(["ACADEMIC_FEE", "ACADEMIC_CAUTION", "HOSTEL_FEE", "HOSTEL_SECURITY"], {
      errorMap: () => ({ message: "component must be a fee component" }),
    }),
    studyYear: z.number().int().positive("studyYear must be a positive integer"),
    amount: positiveAmount("amount"),
  })
  .strict();

const updateHostelRateBody = z
  .object({
    condition: z.enum(["AC", "Non-AC"], {
      errorMap: () => ({ message: "condition must be AC or Non-AC" }),
    }),
    occupancy: z.string().trim().min(1, "occupancy is required").max(30, "occupancy must be at most 30 characters"),
    annualFee: positiveAmount("annualFee"),
  })
  .strict();

const runFinesBody = z
  .object({
    asOfDate: isoDate,
    actedBy,
  })
  .strict();

const waiveFineBody = z
  .object({
    amount: positiveAmount("amount"),
    actedBy,
    reason: z.string().trim().min(1, "reason is required").max(255, "reason must be at most 255 characters"),
  })
  .strict();

const refundDepositBody = z
  .object({
    amount: positiveAmount("amount"),
    actedBy,
    reason: z.string().trim().min(1, "reason is required").max(255, "reason must be at most 255 characters"),
    deductionAmount: positiveAmount("deductionAmount").optional(),
    deductionReason: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine((value) => value.deductionAmount == null || value.deductionReason, {
    message: "deductionReason is required",
    path: ["deductionReason"],
  });

const adjustDepositBody = z
  .object({
    amount: positiveAmount("amount"),
    actedBy,
    reason: z.string().trim().min(1, "reason is required").max(255, "reason must be at most 255 characters"),
  })
  .strict();

module.exports = {
  createAcademicYearBody,
  createSemesterBody,
  createFeeStructureBody,
  updateHostelRateBody,
  runFinesBody,
  waiveFineBody,
  refundDepositBody,
  adjustDepositBody,
  idParams: idParams(),
  entryIdParams: idParams("entryId"),
  accountIdParams: idParams("accountId"),
};
