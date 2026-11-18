const { z } = require("zod");

const loginBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
}).strict();

module.exports = { loginBody };
