const express = require('express');
const config = require('./config');
const producer = require('./producer');
const consumer = require('./consumer');
const eventRoutes = require('./api/routes');

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const isProducerConnected = producer.isProducerConnected();
  const isConsumerConnected = consumer.isConsumerConnected();

  if (isProducerConnected && isConsumerConnected) {
    return res.status(200).json({
      status: 'healthy',
      producer: 'connected',
      consumer: 'connected',
    });
  }

  return res.status(503).json({
    status: 'degraded',
    producer: isProducerConnected ? 'connected' : 'disconnected',
    consumer: isConsumerConnected ? 'connected' : 'disconnected',
  });
});

// API routes
app.use('/events', eventRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

/**
 * Initialize and start the application
 */
async function startApplication() {
  try {
    console.log('[App] Initializing Kafka producer...');
    await producer.initialize();

    console.log('[App] Initializing Kafka consumer...');
    await consumer.initialize();

    console.log('[App] Starting Kafka consumer...');
    await consumer.startConsuming();

    // Start the Express server
    const port = config.port;
    app.listen(port, () => {
      console.log(`[App] Server listening on port ${port}`);
      console.log(`[App] Environment: ${config.nodeEnv}`);
      console.log(`[App] Kafka brokers: ${config.kafka.brokers.join(', ')}`);
      console.log(`[App] Kafka topic: ${config.kafka.topic}`);
      console.log(`[App] Consumer group: ${config.kafka.consumerGroup}`);
    });
  } catch (error) {
    console.error('[App] Failed to start application:', error);
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown() {
  console.log('[App] Shutting down gracefully...');
  try {
    await producer.disconnect();
    await consumer.disconnect();
    console.log('[App] Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('[App] Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the application
startApplication();
