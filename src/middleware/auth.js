const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Bypass authentication for all endpoints during development
    console.log('Bypassing authentication for endpoint:', req.path);
    return next();

    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Authentication token is required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = authMiddleware;