import { Router } from "express";
import { verifyUser } from "../services/auth-store.js";
import { signToken } from "../services/tokens.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({
      error: "email and password are required",
      code: "VALIDATION_ERROR",
      details: {}
    });
  }

  const user = verifyUser(String(email), String(password));
  if (!user) {
    return res.status(401).json({
      error: "Invalid credentials",
      code: "AUTH_REQUIRED",
      details: {}
    });
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  return res.json({
    accessToken: token,
    user: { id: user.id, email: user.email, role: user.role }
  });
});

export default router;
