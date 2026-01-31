import jwt from "jsonwebtoken";

type TokenPayload = {
  sub: string;
  email: string;
  role: "admin" | "user";
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    console.warn("JWT_SECRET missing; set it in backend/.env");
  }
  return secret;
}

export function signToken(payload: TokenPayload): string {
  const secret = getSecret();
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}
