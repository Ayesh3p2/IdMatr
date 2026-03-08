import { sign, verify } from 'jsonwebtoken';

export const generateToken = (payload: any, secret: string, expiresIn: string = '1h') => {
  return sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string, secret: string) => {
  try {
    return verify(token, secret);
  } catch (err) {
    return null;
  }
};

export const checkPermissions = (userPermissions: string[], requiredPermission: string) => {
  return userPermissions.includes(requiredPermission) || userPermissions.includes('admin');
};
