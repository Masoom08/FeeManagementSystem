const { z } = require("zod");

function idSchema(name) {
  return z
    .string()
    .regex(/^[1-9]\d*$/, `${name} must be a positive integer`)
    .transform((value) => Number(value));
}

function idParams(name = "id") {
  return z.object({
    [name]: idSchema(name),
  });
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const actedBy = z
  .string({
    required_error: "actedBy is required",
    invalid_type_error: "actedBy must be a string",
  })
  .trim()
  .min(1, "actedBy is required")
  .max(80, "actedBy must be at most 80 characters");

const positiveAmount = (name) =>
  z
    .number({
      required_error: `${name} is required`,
      invalid_type_error: `${name} must be an integer`,
    })
    .int(`${name} must be an integer`)
    .positive(`${name} must be a positive integer`);

module.exports = {
  idSchema,
  idParams,
  isoDate,
  actedBy,
  positiveAmount,
};
