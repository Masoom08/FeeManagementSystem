
const prisma = require("../../lib/prisma");
const cascadeDelete = require("../../lib/cascadeDelete");

function duplicateCourseError() {
  const error = new Error("DUPLICATE_COURSE_CODE");
  error.code = "DUPLICATE_COURSE_CODE";
  error.status = 409;
  return error;
}

function notFoundError() {
  const error = new Error("NOT_FOUND");
  error.code = "NOT_FOUND";
  error.status = 404;
  return error;
}

async function createCourse(data) {
  try {
    return await prisma.course.create({ data });
  } catch (err) {
    if (err.code === "P2002") {
      throw duplicateCourseError();
    }
    throw err;
  }
}

function listCourses() {
  return prisma.course.findMany({
    orderBy: { id: "asc" },
  });
}

async function getCourse(id) {
  const course = await prisma.course.findUnique({ where: { id } });

  if (!course) {
    throw notFoundError();
  }

  return course;
}

async function updateCourse(id, data) {
  await getCourse(id);

  try {
    return await prisma.course.update({
      where: { id },
      data,
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw duplicateCourseError();
    }
    throw err;
  }
}

// Preview related records before deleting a course
function previewCourseDelete(id) {
  return cascadeDelete.previewCourse(id);
}

// Deactivate a course without deleting associated records
async function deactivateCourse(id) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          students: true,
          feeStructures: true,
        },
      },
    },
  });

  if (!course) {
    throw notFoundError();
  }

  if (course._count.students || course._count.feeStructures) {
    return updateCourse(id, { active: false });
  }

  await prisma.course.delete({ where: { id } });

  return { id, deleted: true };
}

// Permanently delete a course using cascade deletion
function deleteCourse(id) {
  return cascadeDelete.deleteCourse(id);
}

module.exports = {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  previewCourseDelete,
  deactivateCourse,
  deleteCourse,
};
