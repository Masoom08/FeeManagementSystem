const express = require("express");
const { validate } = require("../../middleware/validate");
const controller = require("./auth.controller");
const schemas = require("./auth.validation");

const router = express.Router();
router.post("/login", validate({ body: schemas.loginBody }), controller.login);

module.exports = router;
