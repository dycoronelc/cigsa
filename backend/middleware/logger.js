import { getConnection } from '../config/database.js';

export const logActivity = async (userId, action, entityType, entityId, description, ipAddress) => {
  try {
    const pool = await getConnection();
    await pool.query(
      'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, description, ipAddress]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

export const activityLogger = (action, entityType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      if (res.statusCode < 400) {
        const entityId = req.params.id || req.body.id || null;
        const description = `${action} ${entityType}${entityId ? ` (ID: ${entityId})` : ''}`;
        logActivity(
          req.user?.id,
          action,
          entityType,
          entityId,
          description,
          req.ip || req.connection.remoteAddress
        );
      }
      return originalSend.call(this, data);
    };
    next();
  };
};

