import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/tokens.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authorization required",
      code: "AUTH_REQUIRED",
      details: {}
    });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "AUTH_REQUIRED",
      details: {}
    });
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role
  };

  return next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authorization required",
      code: "AUTH_REQUIRED",
      details: {}
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      code: "FORBIDDEN",
      details: {}
    });
  }

  return next();
}
