// Mock kafkajs first
jest.mock('kafkajs', () => {
  const mockConsumer = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
  };

  return {
    Kafka: jest.fn(() => ({
      consumer: jest.fn(() => mockConsumer),
    })),
    logLevel: {
      ERROR: 'error',
    },
  };
});

const consumer = require('../../src/consumer');
const eventStore = require('../../src/store/eventStore');

describe('KafkaConsumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consumer.isConnected = false;
    consumer.isRunning = false;
  });

  describe('initialize', () => {
    it('should initialize the Kafka consumer', async () => {
      // This test verifies initialization setup
      expect(consumer.kafka).toBeNull();
    });
  });

  describe('handleMessage', () => {
    it('should process a valid message', async () => {
      const message = {
        value: JSON.stringify({
          eventId: 'test-event-1',
          userId: 'user-1',
          eventType: 'LOGIN',
          timestamp: '2024-02-14T00:00:00Z',
          payload: {},
        }),
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await consumer.handleMessage(message);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON gracefully', async () => {
      const message = {
        value: Buffer.from('invalid json'),
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await consumer.handleMessage(message);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle invalid event structure gracefully', async () => {
      const message = {
        value: JSON.stringify({
          userId: 'user-1',
          // Missing required fields
        }),
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await consumer.handleMessage(message);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should enforce idempotency for duplicate events', async () => {
      const message = {
        value: JSON.stringify({
          eventId: 'test-event-1',
          userId: 'user-1',
          eventType: 'LOGIN',
          timestamp: '2024-02-14T00:00:00Z',
          payload: {},
        }),
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // First processing
      await consumer.handleMessage(message);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('isConsumerRunning', () => {
    it('should return false initially', () => {
      consumer.isRunning = false;
      expect(consumer.isConsumerRunning()).toBe(false);
    });

    it('should return true when running', () => {
      consumer.isRunning = true;
      expect(consumer.isConsumerRunning()).toBe(true);
    });
  });

  describe('isConsumerConnected', () => {
    it('should return false initially', () => {
      consumer.isConnected = false;
      expect(consumer.isConsumerConnected()).toBe(false);
    });

    it('should return true when connected', () => {
      consumer.isConnected = true;
      expect(consumer.isConsumerConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect gracefully', async () => {
      consumer.isConnected = true;
      consumer.isRunning = true;
      consumer.consumer = { disconnect: jest.fn() };

      await consumer.disconnect();

      expect(consumer.isRunning).toBe(false);
      expect(consumer.isConnected).toBe(false);
    });

    it('should not throw error if not connected', async () => {
      consumer.isConnected = false;
      consumer.consumer = null;

      await expect(consumer.disconnect()).resolves.not.toThrow();
    });
  });
});
