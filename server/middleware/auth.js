import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'praman-prototype-secret-key-2026';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, employee_id: user.employee_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export default { authenticateToken, requireRole, createToken };
