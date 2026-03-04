import jwt from "jsonwebtoken";
const NON_PROD_FALLBACK_SECRET = "clustercodex-non-prod-jwt-secret";
let hasWarnedAboutFallback = false;
function isProduction() {
    return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}
function getSecret() {
    const secret = String(process.env.JWT_SECRET || "").trim();
    if (secret) {
        return secret;
    }
    if (isProduction()) {
        throw new Error("JWT_SECRET is required when NODE_ENV=production");
    }
    if (!hasWarnedAboutFallback) {
        console.warn("JWT_SECRET missing; using insecure fallback secret for non-production environments.");
        hasWarnedAboutFallback = true;
    }
    return NON_PROD_FALLBACK_SECRET;
}
export function signToken(payload) {
    const secret = getSecret();
    return jwt.sign(payload, secret, { expiresIn: "8h" });
}
export function verifyToken(token) {
    const secret = getSecret();
    if (!secret)
        return null;
    try {
        return jwt.verify(token, secret);
    }
    catch {
        return null;
    }
}
