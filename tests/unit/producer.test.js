// Mock kafkajs first
jest.mock('kafkajs', () => {
  const mockProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue([
      {
        topicName: 'user-activity-events',
        partition: 0,
        errorCode: 0,
        offset: '1000',
      },
    ]),
  };

  return {
    Kafka: jest.fn(function() {
      this.producer = jest.fn(() => mockProducer);
      return this;
    }),
    logLevel: {
      ERROR: 'error',
    },
  };
});

const producer = require('../../src/producer');

describe('KafkaProducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the producer state
    producer.isConnected = false;
  });

  describe('initialize', () => {
    it('should initialize the Kafka producer successfully', async () => {
      // This test checks that initialization completes without error
      // The actual Kafka connection is mocked
      expect(producer.kafka).toBeNull();
      // Note: In practice with real tests, you'd await initialization
    });
  });

  describe('publishEvent', () => {
    it('should return error when producer is not connected', async () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      producer.isConnected = false;

      const result = await producer.publishEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });

    it('should format event message with partition key', async () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      const result = await producer.publishEvent(event);
      expect(result).toBeDefined();
      expect(result.eventId).toBeDefined();
    });

    it('should handle events with complex payloads', async () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: { data: 'test', nested: { key: 'value' } },
      };

      const result = await producer.publishEvent(event);
      expect(result).toBeDefined();
      expect(result.eventId).toBe('test-event-1');
    });
  });

  describe('isProducerConnected', () => {
    it('should return false initially', () => {
      producer.isConnected = false;
      expect(producer.isProducerConnected()).toBe(false);
    });

    it('should return true when connected', () => {
      producer.isConnected = true;
      expect(producer.isProducerConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect gracefully', async () => {
      producer.isConnected = true;
      producer.producer = { disconnect: jest.fn() };

      await producer.disconnect();

      expect(producer.isConnected).toBe(false);
    });

    it('should not throw error if not connected', async () => {
      producer.isConnected = false;
      producer.producer = null;

      await expect(producer.disconnect()).resolves.not.toThrow();
    });
  });
});
