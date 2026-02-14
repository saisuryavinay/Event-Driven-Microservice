const { Kafka, logLevel } = require('kafkajs');
const config = require('./config');

/**
 * KafkaProducer - Handles publishing events to Kafka
 * Implements retry logic and error handling for transient failures
 */
class KafkaProducer {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.isConnected = false;
  }

  /**
   * Initializes the Kafka producer
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.kafka = new Kafka({
        clientId: 'event-producer',
        brokers: config.kafka.brokers,
        logLevel: logLevel.ERROR,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        retry: {
          maxRetryTime: 30000,
          initialRetryTime: 100,
          retries: config.kafka.producer.retries,
        },
      });

      this.producer = this.kafka.producer({
        timeout: config.kafka.producer.timeout,
        retries: config.kafka.producer.retries,
        idempotent: true,
      });

      await this.producer.connect();
      this.isConnected = true;
      console.log('[Producer] Connected to Kafka successfully');
    } catch (error) {
      console.error('[Producer] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Publishes an event to Kafka
   * @param {Object} event - The UserEvent object to publish
   * @returns {Promise<Object>} - Returns { success: boolean, eventId: string, error?: string }
   */
  async publishEvent(event) {
    if (!this.isConnected) {
      return {
        success: false,
        eventId: event?.eventId,
        error: 'Kafka producer is not connected',
      };
    }

    try {
      const messages = [
        {
          key: event.userId, // Partition by userId for ordered processing
          value: JSON.stringify(event),
          headers: {
            'event-type': event.eventType,
            'event-id': event.eventId,
          },
        },
      ];

      const sendPromise = this.producer.send({
        topic: config.kafka.topic,
        messages,
        timeout: config.kafka.producer.timeout,
        compression: 1, // Gzip compression
      });

      const result = await sendPromise;

      console.log(
        `[Producer] Event published successfully - eventId: ${event.eventId}, userId: ${event.userId}, eventType: ${event.eventType}`,
      );

      return {
        success: true,
        eventId: event.eventId,
      };
    } catch (error) {
      console.error(`[Producer] Failed to publish event ${event?.eventId}:`, error.message);
      return {
        success: false,
        eventId: event?.eventId,
        error: error.message,
      };
    }
  }

  /**
   * Checks if the producer is connected
   * @returns {boolean}
   */
  isProducerConnected() {
    return this.isConnected;
  }

  /**
   * Gracefully disconnects the producer
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.producer && this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        console.log('[Producer] Disconnected from Kafka');
      } catch (error) {
        console.error('[Producer] Error during disconnect:', error.message);
      }
    }
  }
}

module.exports = new KafkaProducer();
