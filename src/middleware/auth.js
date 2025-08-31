import jwt from 'jsonwebtoken';

/**
 * protect(roles) returns middleware that:
 *  - verifies a Bearer token
 *  - checks user.role is in [roles]
 */
export const protect = (roles = []) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ msg: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const { id, role } = jwt.verify(token, process.env.JWT_SECRET);
    if (roles.length && !roles.includes(role))
      return res.status(403).json({ msg: 'Forbidden' });

    req.user = { id, role };
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid token' });
  }
};
