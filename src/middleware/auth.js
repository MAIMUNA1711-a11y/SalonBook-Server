import { createRemoteJWKSet, jwtVerify } from "jose";
import { User } from "../models/index.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

let jwks;
const getJwks = () => {
  if (!jwks) {
    const base = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    jwks = createRemoteJWKSet(new URL(`${base}/api/auth/jwks`));
  }
  return jwks;
};

/**
 * JWT verification middleware.
 * 1. Reads "Authorization: Bearer <jwt>" (token issued by Better Auth's JWT plugin)
 * 2. Verifies signature + issuer against the client's JWKS endpoint
 * 3. Loads the user from MongoDB so role / isBlocked are always fresh (never trusted from the token)
 */
export const verifyJWT = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new ApiError(401, "Authentication required");
  const token = header.slice(7);

  let payload;
  try {
    const issuer = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    ({ payload } = await jwtVerify(token, getJwks(), { issuer }));
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  const user = await User.findById(payload.sub).lean();
  if (!user) throw new ApiError(401, "User not found");
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked");

  req.user = { ...user, id: String(user._id) };
  next();
});

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }
    next();
  };

export const requireAdmin = requireRole("admin");
export const requireCustomer = requireRole("customer");
