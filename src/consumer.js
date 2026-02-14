const { Kafka, logLevel } = require('kafkajs');
const config = require('./config');
const eventStore = require('./store/eventStore');
const { validateCompleteUserEvent } = require('./models/userEvent');

/**
 * KafkaConsumer - Handles consuming events from Kafka
 * Implements idempotency and error handling for malformed messages
 */
class KafkaConsumer {
  constructor() {
    this.kafka = null;
    this.consumer = null;
    this.isConnected = false;
    this.isRunning = false;
  }

  /**
   * Initializes the Kafka consumer
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.kafka = new Kafka({
        clientId: 'event-consumer',
        brokers: config.kafka.brokers,
        logLevel: logLevel.ERROR,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        retry: {
          maxRetryTime: 30000,
          initialRetryTime: 100,
          retries: 8,
        },
      });

      this.consumer = this.kafka.consumer({
        groupId: config.kafka.consumerGroup,
        sessionTimeout: config.kafka.consumer.sessionTimeout,
        heartbeatInterval: config.kafka.consumer.heartbeatInterval,
      });

      await this.consumer.connect();
      this.isConnected = true;
      console.log('[Consumer] Connected to Kafka successfully');
    } catch (error) {
      console.error('[Consumer] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Starts consuming messages from the Kafka topic
   * @returns {Promise<void>}
   */
  async startConsuming() {
    if (!this.isConnected) {
      throw new Error('Consumer is not connected. Call initialize() first.');
    }

    try {
      await this.consumer.subscribe({
        topic: config.kafka.topic,
        fromBeginning: false, // Start from the latest offset
      });

      console.log(`[Consumer] Subscribed to topic: ${config.kafka.topic}`);

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleMessage(message);
        },
      });

      this.isRunning = true;
      console.log(
        `[Consumer] Started consuming messages from ${config.kafka.topic} as part of group ${config.kafka.consumerGroup}`,
      );
    } catch (error) {
      console.error('[Consumer] Failed to start consuming:', error.message);
      throw error;
    }
  }

  /**
   * Processes a single message from Kafka
   * Implements error handling for malformed messages and idempotency checks
   * @param {Object} message - The Kafka message object
   * @returns {Promise<void>}
   */
  async handleMessage(message) {
    try {
      // Parse the message value
      let event;
      try {
        event = JSON.parse(message.value.toString());
      } catch (parseError) {
        console.error(
          '[Consumer] Failed to parse message: malformed JSON',
          parseError.message,
        );
        return; // Skip this message gracefully
      }

      // Validate the complete event structure
      const validation = validateCompleteUserEvent(event);
      if (!validation.valid) {
        console.error('[Consumer] Invalid event structure:', validation.errors.join(', '));
        return; // Skip this invalid message gracefully
      }

      // Store the event (idempotency check happens inside storeEvent)
      const storeResult = eventStore.storeEvent(event);

      if (storeResult.stored) {
        console.log(
          `[Consumer] Event processed - eventId: ${event.eventId}, userId: ${event.userId}, eventType: ${event.eventType}`,
        );
      } else {
        console.log(`[Consumer] ${storeResult.message}`);
      }
    } catch (error) {
      console.error('[Consumer] Unexpected error while processing message:', error.message);
      // Don't crash the consumer on unexpected errors
    }
  }

  /**
   * Checks if the consumer is running
   * @returns {boolean}
   */
  isConsumerRunning() {
    return this.isRunning;
  }

  /**
   * Checks if the consumer is connected
   * @returns {boolean}
   */
  isConsumerConnected() {
    return this.isConnected;
  }

  /**
   * Gracefully disconnects the consumer
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.consumer && this.isConnected) {
      try {
        this.isRunning = false;
        await this.consumer.disconnect();
        this.isConnected = false;
        console.log('[Consumer] Disconnected from Kafka');
      } catch (error) {
        console.error('[Consumer] Error during disconnect:', error.message);
      }
    }
  }
}

module.exports = new KafkaConsumer();
