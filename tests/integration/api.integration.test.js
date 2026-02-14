jest.mock('../../src/producer');

const request = require('supertest');
const express = require('express');

// Setup producer mock BEFORE importing routes
const producer = require('../../src/producer');
producer.isProducerConnected = jest.fn(() => true);
producer.publishEvent = jest.fn().mockResolvedValue({
  success: true,
});
producer.initialize = jest.fn();
producer.disconnect = jest.fn();

const eventRoutes = require('../../src/api/routes');
const eventStore = require('../../src/store/eventStore');

describe('Event API Integration Tests', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());

    // Add health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    // Add event routes
    app.use('/events', eventRoutes);

    // Clear the event store before each test
    eventStore.clear();
    jest.clearAllMocks();

    // Reset producer mock
    producer.isProducerConnected.mockReturnValue(true);
    producer.publishEvent.mockResolvedValue({
      success: true,
    });
  });

  describe('POST /events/generate', () => {
    it('should create and publish an event successfully', async () => {
      const eventPayload = {
        userId: 'user-123',
        eventType: 'LOGIN',
        payload: { ipAddress: '192.168.1.1' },
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.event).toBeDefined();
      expect(response.body.event.eventId).toBeDefined();
      expect(response.body.event.userId).toBe('user-123');
      expect(response.body.event.eventType).toBe('LOGIN');
      expect(response.body.event.timestamp).toBeDefined();
      expect(response.body.event.payload).toEqual({ ipAddress: '192.168.1.1' });
    });

    it('should return 400 for missing userId', async () => {
      const eventPayload = {
        eventType: 'LOGIN',
        payload: {},
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing eventType', async () => {
      const eventPayload = {
        userId: 'user-123',
        payload: {},
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 400 for invalid eventType', async () => {
      const eventPayload = {
        userId: 'user-123',
        eventType: 'INVALID_TYPE',
        payload: {},
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 400 for invalid payload type', async () => {
      const eventPayload = {
        userId: 'user-123',
        eventType: 'LOGIN',
        payload: 'not-an-object',
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should accept empty payload', async () => {
      const eventPayload = {
        userId: 'user-123',
        eventType: 'LOGOUT',
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.event.payload).toEqual({});
    });

    it('should handle Kafka publish failure gracefully', async () => {
      producer.publishEvent.mockResolvedValueOnce({
        success: false,
        eventId: 'test-id',
        error: 'Kafka unavailable',
      });

      const eventPayload = {
        userId: 'user-123',
        eventType: 'LOGIN',
        payload: {},
      };

      const response = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should generate unique eventIds for multiple events', async () => {
      const eventPayload = {
        userId: 'user-123',
        eventType: 'LOGIN',
        payload: {},
      };

      const response1 = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(201);

      const response2 = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(201);

      expect(response1.body.event.eventId).not.toBe(response2.body.event.eventId);
    });
  });

  describe('GET /events/processed', () => {
    it('should return empty array initially', async () => {
      const response = await request(app)
        .get('/events/processed')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return all processed events', async () => {
      // Add events to the store
      eventStore.storeEvent({
        eventId: 'event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      });

      eventStore.storeEvent({
        eventId: 'event-2',
        userId: 'user-2',
        eventType: 'LOGOUT',
        timestamp: '2024-02-14T01:00:00Z',
        payload: {},
      });

      const response = await request(app)
        .get('/events/processed')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].eventId).toBe('event-1');
      expect(response.body[1].eventId).toBe('event-2');
    });

    it('should return events with correct structure', async () => {
      eventStore.storeEvent({
        eventId: 'event-1',
        userId: 'user-1',
        eventType: 'PRODUCT_VIEW',
        timestamp: '2024-02-14T00:00:00Z',
        payload: { productId: '123' },
      });

      const response = await request(app)
        .get('/events/processed')
        .expect(200);

      expect(response.body.length).toBe(1);
      const event = response.body[0];
      expect(event.eventId).toBe('event-1');
      expect(event.userId).toBe('user-1');
      expect(event.eventType).toBe('PRODUCT_VIEW');
      expect(event.timestamp).toBe('2024-02-14T00:00:00Z');
      expect(event.payload).toEqual({ productId: '123' });
    });

    it('should only return unique events (test idempotency)', async () => {
      const event = {
        eventId: 'event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      // Attempt to store the same event twice
      eventStore.storeEvent(event);
      eventStore.storeEvent(event);

      const response = await request(app)
        .get('/events/processed')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].eventId).toBe('event-1');
    });
  });

  describe('End-to-end flow (generate and retrieve)', () => {
    it('should publish an event and retrieve it via API', async () => {
      const eventPayload = {
        userId: 'user-123',
        eventType: 'LOGIN',
        payload: { ipAddress: '192.168.1.1' },
      };

      // Generate an event
      const generateResponse = await request(app)
        .post('/events/generate')
        .send(eventPayload)
        .expect(201);

      expect(generateResponse.body.success).toBe(true);

      const publishedEvent = generateResponse.body.event;

      // Simulate consumer processing the event
      eventStore.storeEvent(publishedEvent);

      // Retrieve processed events
      const processedResponse = await request(app)
        .get('/events/processed')
        .expect(200);

      expect(Array.isArray(processedResponse.body)).toBe(true);
      expect(processedResponse.body.length).toBe(1);
      expect(processedResponse.body[0].eventId).toBe(publishedEvent.eventId);
      expect(processedResponse.body[0].userId).toBe('user-123');
      expect(processedResponse.body[0].eventType).toBe('LOGIN');
    });

    it('should handle multiple events with idempotency', async () => {
      // Generate event 1
      const event1Payload = {
        userId: 'user-1',
        eventType: 'LOGIN',
        payload: {},
      };

      const response1 = await request(app)
        .post('/events/generate')
        .send(event1Payload)
        .expect(201);

      const event1 = response1.body.event;

      // Generate event 2
      const event2Payload = {
        userId: 'user-2',
        eventType: 'PRODUCT_VIEW',
        payload: { productId: '456' },
      };

      const response2 = await request(app)
        .post('/events/generate')
        .send(event2Payload)
        .expect(201);

      const event2 = response2.body.event;

      // Store both events in the store
      eventStore.storeEvent(event1);
      eventStore.storeEvent(event2);

      // Try to store event 1 again (should fail due to idempotency)
      const storeResult = eventStore.storeEvent(event1);
      expect(storeResult.stored).toBe(false);

      // Verify only 2 unique events are stored
      const processedResponse = await request(app)
        .get('/events/processed')
        .expect(200);

      expect(processedResponse.body.length).toBe(2);
    });
  });
});
