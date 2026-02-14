const express = require('express');
const { createUserEvent, validateUserEvent } = require('../models/userEvent');
const producer = require('../producer');
const eventStore = require('../store/eventStore');

const router = express.Router();

/**
 * POST /events/generate
 * Generate and publish a new event to Kafka
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "eventType": "LOGIN | LOGOUT | PRODUCT_VIEW",
 *   "payload": { } (optional)
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "event": {
 *     "eventId": "uuid",
 *     "userId": "string",
 *     "eventType": "string",
 *     "timestamp": "ISO8601",
 *     "payload": {}
 *   }
 * }
 *
 * Response (400 Bad Request):
 * {
 *   "success": false,
 *   "errors": ["error1", "error2"]
 * }
 *
 * Response (500 Internal Server Error):
 * {
 *   "success": false,
 *   "error": "error message"
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const { userId, eventType, payload } = req.body;

    // Validate input
    const validation = validateUserEvent({
      userId,
      eventType,
      payload,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    // Create the complete UserEvent
    const event = createUserEvent({
      userId,
      eventType,
      payload,
    });

    if (!event) {
      return res.status(400).json({
        success: false,
        errors: ['Failed to create event'],
      });
    }

    // Publish to Kafka
    const publishResult = await producer.publishEvent(event);

    if (!publishResult.success) {
      return res.status(500).json({
        success: false,
        error: publishResult.error || 'Failed to publish event',
      });
    }

    // Return the created event
    return res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('[API] Error in POST /events/generate:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /events/processed
 * Retrieve all processed events from the event store
 *
 * Response (200 OK):
 * [
 *   {
 *     "eventId": "uuid",
 *     "userId": "string",
 *     "eventType": "string",
 *     "timestamp": "ISO8601",
 *     "payload": {}
 *   }
 * ]
 */
router.get('/processed', (req, res) => {
  try {
    const events = eventStore.getAllProcessedEvents();
    return res.status(200).json(events);
  } catch (error) {
    console.error('[API] Error in GET /events/processed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

module.exports = router;
