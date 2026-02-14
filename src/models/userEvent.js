const { v4: uuidv4 } = require('uuid');

/**
 * UserEvent schema and validation
 * Represents a user activity event in the system
 */

const VALID_EVENT_TYPES = ['LOGIN', 'LOGOUT', 'PRODUCT_VIEW'];

/**
 * Validates a UserEvent object
 * @param {Object} event - The event object to validate
 * @returns {Object} - Returns { valid: boolean, errors: Array }
 */
function validateUserEvent(event) {
  const errors = [];

  if (!event) {
    errors.push('Event object is required');
    return { valid: false, errors };
  }

  if (!event.userId || typeof event.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!event.eventType || !VALID_EVENT_TYPES.includes(event.eventType)) {
    errors.push(`eventType is required and must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
  }

  if (event.payload && typeof event.payload !== 'object') {
    errors.push('payload must be an object if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a complete UserEvent object
 * @param {Object} eventData - Partial event data (userId, eventType, payload)
 * @returns {Object|null} - Complete UserEvent object or null if invalid
 */
function createUserEvent(eventData) {
  const validation = validateUserEvent(eventData);

  if (!validation.valid) {
    return null;
  }

  return {
    eventId: uuidv4(),
    userId: eventData.userId,
    eventType: eventData.eventType,
    timestamp: new Date().toISOString(),
    payload: eventData.payload || {},
  };
}

/**
 * Validates a complete UserEvent object (with eventId and timestamp)
 * Used for validating events coming from Kafka
 * @param {Object} event - The complete event object
 * @returns {Object} - Returns { valid: boolean, errors: Array }
 */
function validateCompleteUserEvent(event) {
  const errors = [];

  if (!event) {
    errors.push('Event object is required');
    return { valid: false, errors };
  }

  if (!event.eventId || typeof event.eventId !== 'string') {
    errors.push('eventId is required and must be a string');
  }

  if (!event.userId || typeof event.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!event.eventType || !VALID_EVENT_TYPES.includes(event.eventType)) {
    errors.push(`eventType is required and must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
  }

  if (!event.timestamp || typeof event.timestamp !== 'string') {
    errors.push('timestamp is required and must be a string (ISO 8601 format)');
  }

  if (event.payload && typeof event.payload !== 'object') {
    errors.push('payload must be an object if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  VALID_EVENT_TYPES,
  validateUserEvent,
  validateCompleteUserEvent,
  createUserEvent,
};
