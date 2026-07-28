import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET ;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

/**
 * Generate Access Token (Short-lived)
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      name: user.name,
      role: user.role?.name || user.roleName,
      organizationId: user.organization?.toString() || user.organizationId,
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: "1h" }
  );
};

/**
 * Generate SuperAdmin Access Token
 */
export const generateSuperAdminToken = (superAdmin) => {
  return jwt.sign(
    {
      id: superAdmin._id || superAdmin.id,
      name: superAdmin.name,
      role: "SuperAdmin",
      isSuperAdmin: true,
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: "1h" }
  );
};

/**
 * Generate Refresh Token (Long-lived)
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id || user.id },
    REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
};

/**
 * Verify Access Token
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};
