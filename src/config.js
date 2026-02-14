require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(','),
    topic: process.env.KAFKA_TOPIC || 'user-activity-events',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'user-activity-consumer-group',
    producer: {
      timeout: parseInt(process.env.KAFKA_PRODUCER_TIMEOUT_MS || '30000', 10),
      retries: parseInt(process.env.KAFKA_PRODUCER_RETRIES || '3', 10),
      retryBackoffMs: parseInt(process.env.KAFKA_PRODUCER_RETRY_BACKOFF_MS || '100', 10),
    },
    consumer: {
      sessionTimeout: parseInt(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS || '30000', 10),
      heartbeatInterval: parseInt(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS || '3000', 10),
      autoCommit: process.env.KAFKA_CONSUMER_AUTO_COMMIT_ENABLED === 'true',
      autoCommitInterval: parseInt(process.env.KAFKA_CONSUMER_AUTO_COMMIT_INTERVAL_MS || '5000', 10),
    },
  },
};
