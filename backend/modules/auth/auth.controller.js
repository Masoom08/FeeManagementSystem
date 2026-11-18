const { asyncRoute } = require("../../lib/asyncRoute");
const authService = require("./auth.service");

const login = asyncRoute(async (req, res) => {
  const data = await authService.login(req.body.email, req.body.password);
  res.status(200).json({ success: true, data });
});

module.exports = { login };
