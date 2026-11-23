const courseService = require("./course.service");

async function createCourse(req, res, next) {
  try {
    const course = await courseService.createCourse(req.body);
    res.status(201).json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
}

async function listCourses(req, res, next) {
  try {
    const courses = await courseService.listCourses();
    res.status(200).json({ success: true, data: courses });
  } catch (err) {
    next(err);
  }
}

async function getCourse(req, res, next) {
  try {
    const course = await courseService.getCourse(req.params.id);
    res.status(200).json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
}

async function updateCourse(req, res, next) {
  try {
    const course = await courseService.updateCourse(req.params.id, req.body);
    res.status(200).json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
}

async function previewCourseDelete(req, res, next) {
  try {
    const impact = await courseService.previewCourseDelete(req.params.id);
    res.status(200).json({ success: true, data: impact });
  } catch (err) {
    next(err);
  }
}

async function deleteCourse(req, res, next) {
  try {
    const result = await courseService.deleteCourse(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  previewCourseDelete,
  deleteCourse,
};
