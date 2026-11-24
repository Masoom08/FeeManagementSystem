const prisma = require("../../lib/prisma");
const { badRequest, conflict, notFound } = require("../../lib/errors");
const { parseISODate } = require("../../lib/dates");

function listBatches() {
  return prisma.batch.findMany({ include: { course: { select: { id: true, courseName: true, courseCode: true } } }, orderBy: [{ startDate: "desc" }, { label: "asc" }] });
}

async function createBatch(data) {
  const startDate = parseISODate(data.startDate);
  const endDate = parseISODate(data.endDate);
  if (endDate <= startDate) throw badRequest("INVALID_DATE_RANGE", [{ path: "endDate", message: "endDate must be after startDate" }]);
  if (!await prisma.course.findUnique({ where: { id: data.courseId } })) throw notFound("COURSE_NOT_FOUND");
  try {
    return await prisma.batch.create({ data: { ...data, startDate, endDate } });
  } catch (err) {
    if (err.code === "P2002") throw conflict("DUPLICATE_BATCH");
    throw err;
  }
}

module.exports = { listBatches, createBatch };
