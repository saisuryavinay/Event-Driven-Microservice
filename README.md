# Event-Driven Microservice

A foundational event-driven microservice built with Node.js, Express, and Apache Kafka. This service acts as both a Kafka producer and consumer, demonstrating core event-driven architecture principles including asynchronous message processing, idempotency, and resilient error handling.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Troubleshooting](#troubleshooting)

## Overview

This project implements an event-driven microservice that:

1. **Produces Events**: Exposes a REST API to generate and publish user activity events to Kafka
2. **Consumes Events**: Subscribes to Kafka topics and processes events asynchronously
3. **Ensures Idempotency**: Guarantees that duplicate events are processed only once
4. **Handles Errors Gracefully**: Implements robust error handling for both producer and consumer
5. **Provides Query capability**: Exposes an API to retrieve all processed events

### Use Case

This service is ideal for scenarios such as:
- User activity tracking (logins, logouts, product views)
- Log aggregation across distributed systems
- Real-time data processing pipelines
- Event sourcing and CQRS patterns

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             ▼                                ▼
        ┌─────────────┐              ┌──────────────┐
        │ POST /events│              │ GET /events/ │
        │  /generate  │              │  processed   │
        └────────┬────┘              └──────┬───────┘
                 │                          │
                 ▼                          ▼
         ┌──────────────────────────────────────────┐
         │      Express REST API Server (Port 3000) │
         ├──────────────────────────────────────────┤
         │  - Event Validation                      │
         │  - Producer Integration                  │
         │  - Query Interface                       │
         └───────────────┬──────────────┬───────────┘
                         │              │
              ┌──────────▼──┐     ┌────▼──────────┐
              │   Producer  │     │ Event Store   │
              │  (Kafka)    │     │ (In-Memory)   │
              └──────┬──────┘     └────────────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │   Kafka Broker (9092)│
         │  (Port 29092 internal)|
         └──────────────────────┘
                     ▲
                     │
              ┌──────▼───────┐
              │   Consumer   │
              │  (Kafka)     │
              └──────┬───────┘
                     │
                     ▼
         ┌──────────────────────┐
         │   Event Processing   │
         │  - Validation        │
         │  - Idempotency Check │
         │  - Storage           │
         └──────────────────────┘
```

### Components

1. **API Server**: REST endpoints for event generation and retrieval
2. **Kafka Producer**: Publishes events to Kafka topics
3. **Kafka Consumer**: Consumes events from Kafka and processes them
4. **Event Store**: In-memory storage with idempotency tracking
5. **Configuration Manager**: Centralizes all environment-based settings

## Features

- ✅ **Event-Driven Architecture**: Asynchronous event processing with Kafka
- ✅ **Idempotency**: Events with duplicate IDs are processed only once
- ✅ **Error Handling**: Robust error handling for network failures and malformed messages
- ✅ **Health Checks**: Health endpoints for monitoring service status
- ✅ **Docker Containerization**: Complete docker-compose setup for easy deployment
- ✅ **Comprehensive Testing**: Unit and integration tests with >80% code coverage
- ✅ **Environment Configuration**: All settings managed via environment variables
- ✅ **Graceful Shutdown**: Proper cleanup of Kafka connections
- ✅ **Logging**: Detailed logging for debugging and monitoring

## Prerequisites

- Docker and Docker Compose (v1.29+)
- Node.js 18+ (only if running locally without Docker)
- npm or yarn package manager

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/saisuryavinay/Event-Driven-Microservice.git
cd Event-Driven-Microservice

# Start all services (Kafka, Zookeeper, and the application)
docker-compose up -d

# Verify all services are running
docker-compose ps

# View application logs
docker-compose logs -f app-service
```

The application will be available at `http://localhost:3000`

### Option 2: Local Development Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start Docker services (Kafka and Zookeeper only)
docker-compose up -d kafka zookeeper

# Start the application
npm start

# In another terminal, run the consumer
npm run dev
```

### Verify Installation

```bash
# Check health status
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","producer":"connected","consumer":"connected"}
```

## Configuration

All configuration is managed through environment variables. See [.env.example](.env.example) for all available options.

### Key Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKERS` | `kafka:29092` | Kafka broker addresses (comma-separated) |
| `KAFKA_TOPIC` | `user-activity-events` | Kafka topic name |
| `KAFKA_CONSUMER_GROUP` | `user-activity-consumer-group` | Consumer group ID |
| `PORT` | `3000` | Application server port |
| `NODE_ENV` | `production` | Node environment (development/production) |
| `KAFKA_PRODUCER_RETRIES` | `3` | Number of retry attempts for producer |
| `KAFKA_PRODUCER_TIMEOUT_MS` | `30000` | Producer timeout in milliseconds |
| `KAFKA_CONSUMER_SESSION_TIMEOUT_MS` | `30000` | Consumer session timeout |

## API Endpoints

### 1. Health Check

**Endpoint**: `GET /health`

Check the health status of the service and its dependencies.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "producer": "connected",
  "consumer": "connected"
}
```

**Response** (503 Service Unavailable):
```json
{
  "status": "degraded",
  "producer": "disconnected",
  "consumer": "connected"
}
```

---

### 2. Generate Event

**Endpoint**: `POST /events/generate`

Generate and publish a new user activity event to Kafka.

**Request Body**:
```json
{
  "userId": "user-123",
  "eventType": "LOGIN",
  "payload": {
    "ipAddress": "192.168.1.1",
    "device": "iPhone"
  }
}
```

**Field Descriptions**:
- `userId` (required, string): Unique identifier for the user
- `eventType` (required, string): Type of event - must be one of: `LOGIN`, `LOGOUT`, `PRODUCT_VIEW`
- `payload` (optional, object): Arbitrary JSON object with event-specific data

**Response** (201 Created):
```json
{
  "success": true,
  "event": {
    "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "userId": "user-123",
    "eventType": "LOGIN",
    "timestamp": "2024-02-14T10:30:00.000Z",
    "payload": {
      "ipAddress": "192.168.1.1",
      "device": "iPhone"
    }
  }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "errors": [
    "userId is required and must be a string",
    "eventType is required and must be one of: LOGIN, LOGOUT, PRODUCT_VIEW"
  ]
}
```

**Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Failed to publish event to Kafka"
}
```

---

### 3. Get Processed Events

**Endpoint**: `GET /events/processed`

Retrieve all events that have been successfully consumed and processed by the service.

**Query Parameters**: None

**Response** (200 OK):
```json
[
  {
    "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "userId": "user-123",
    "eventType": "LOGIN",
    "timestamp": "2024-02-14T10:30:00.000Z",
    "payload": {
      "ipAddress": "192.168.1.1"
    }
  },
  {
    "eventId": "d5f2a8c3-7e9b-11ed-a1eb-0242ac120002",
    "userId": "user-456",
    "eventType": "PRODUCT_VIEW",
    "timestamp": "2024-02-14T10:31:00.000Z",
    "payload": {
      "productId": "prod-789"
    }
  }
]
```

**Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Running Tests

### Run All Tests

```bash
docker-compose exec app-service npm test
```

### Run Unit Tests Only

```bash
docker-compose exec app-service npm run test:unit
```

### Run Integration Tests Only

```bash
docker-compose exec app-service npm run test:integration
```

### Run Tests with Coverage

```bash
docker-compose exec app-service npm test -- --coverage
```

### Watch Mode (Development)

```bash
docker-compose exec app-service npm run test:watch
```

### Test Structure

```
tests/
├── unit/                          # Unit tests
│   ├── eventStore.test.js         # Event store idempotency tests
│   ├── producer.test.js           # Kafka producer tests
│   └── consumer.test.js           # Kafka consumer tests
└── integration/
    └── api.integration.test.js    # End-to-end API tests
```

### Test Coverage

- **EventStore**: Tests for idempotency, event storage, and retrieval (100% coverage)
- **Producer**: Tests for event publishing, error handling, and connection management
- **Consumer**: Tests for message parsing, validation, and idempotency enforcement
- **API Integration**: End-to-end tests for REST endpoints and event flow

## Project Structure

```
Event-Driven-Microservice/
├── src/
│   ├── index.js                  # Main application entry point
│   ├── config.js                 # Configuration management
│   ├── producer.js               # Kafka producer implementation
│   ├── consumer.js               # Kafka consumer implementation
│   ├── api/
│   │   └── routes.js             # REST API endpoints
│   ├── models/
│   │   └── userEvent.js          # Event schema and validation
│   └── store/
│       └── eventStore.js         # In-memory event store with idempotency
├── tests/
│   ├── unit/
│   │   ├── eventStore.test.js
│   │   ├── producer.test.js
│   │   └── consumer.test.js
│   └── integration/
│       └── api.integration.test.js
├── docker-compose.yml            # Docker Compose configuration
├── Dockerfile                     # Application Docker image
├── package.json                   # Node.js dependencies
├── .env.example                   # Environment variables template
├── README.md                      # This file
├── ARCHITECTURE.md                # Detailed architecture documentation
└── .gitignore
```

## Design Decisions

### 1. **In-Memory Event Store**
- **Decision**: Use in-memory storage instead of a database
- **Rationale**: Simplifies the project scope and allows focus on Kafka and event processing. In production, this would be replaced with a persistent database (SQL or NoSQL).
- **Trade-off**: Data is lost on application restart; suitable for demonstration purposes

### 2. **Idempotency Implementation**
- **Decision**: Use eventId-based deduplication in the EventStore
- **Rationale**: Simple and effective for detecting duplicate events. Each event has a unique UUID generated by the producer.
- **Implementation**: Map of processed eventIds for O(1) lookup time

### 3. **Error Handling Strategy**
- **Producer**: Implements retry logic with exponential backoff for transient failures
- **Consumer**: Gracefully handles malformed messages and continues processing
- **Design**: Errors are logged but don't crash the service, ensuring resilience

### 4. **Kafka Topic and Consumer Group**
- **Topic**: Single topic `user-activity-events` for all user activity events
- **Consumer Group**: `user-activity-consumer-group` for coordination across consumer instances
- **Partitioning**: Events are partitioned by userId to ensure ordering within a user's event stream

### 5. **Configuration Management**
- **Decision**: Externalize all configuration via environment variables and .env files
- **Benefit**: Easy deployment in different environments (dev, staging, prod)
- **Security**: Sensitive information is not hardcoded

### 6. **Health Checks**
- **Kafka**: Broker API versions check
- **Zookeeper**: TCP connection check
- **Application**: HTTP health endpoint that checks both producer and consumer connectivity

### 7. **Docker Compose Setup**
- **Single-command deployment**: `docker-compose up` starts all services
- **Health checks**: Services wait for dependencies to be healthy before starting
- **Networking**: Custom bridge network for inter-service communication
- **Volumes**: Mounted for development convenience (hot reload)

## Using the Service

### Example 1: Generate a Login Event

```bash
curl -X POST http://localhost:3000/events/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "eventType": "LOGIN",
    "payload": {
      "ipAddress": "192.168.1.1",
      "device": "Chrome"
    }
  }'
```

### Example 2: Generate Multiple Events

```bash
# Logout event
curl -X POST http://localhost:3000/events/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "eventType": "LOGOUT",
    "payload": {}
  }'

# Product view event
curl -X POST http://localhost:3000/events/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "eventType": "PRODUCT_VIEW",
    "payload": {
      "productId": "prod-789",
      "category": "electronics"
    }
  }'
```

### Example 3: Retrieve Processed Events

```bash
# Wait a moment for the consumer to process messages
sleep 2

# Get all processed events
curl http://localhost:3000/events/processed | jq '.'
```

### Example 4: Test Idempotency

```bash
# Generate an event
RESPONSE=$(curl -X POST http://localhost:3000/events/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-demo",
    "eventType": "LOGIN",
    "payload": {}
  }')

EVENT_ID=$(echo $RESPONSE | jq -r '.event.eventId')
echo "Generated event ID: $EVENT_ID"

# Simulate duplicate message (consumer will see it twice but stores only once)
sleep 2

# Check that only one event exists
curl http://localhost:3000/events/processed | jq 'length'
```

## Troubleshooting

### Issue: Services won't start

```bash
# Check if ports are already in use
lsof -i :3000    # Application
lsof -i :9092    # Kafka
lsof -i :2181    # Zookeeper

# Stop existing containers
docker-compose down -v

# Restart
docker-compose up -d
```

### Issue: Consumer not processing messages

```bash
# Check consumer logs
docker-compose logs consumer

# Verify Kafka is running and healthy
docker-compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092
```

### Issue: Connection timeout errors

```bash
# Wait for services to be fully healthy
# This can take 30-60 seconds on first startup
docker-compose logs app-service

# Check health of dependencies
curl http://localhost:3000/health
```

### Issue: Tests failing

```bash
# Ensure services are running
docker-compose ps

# Run tests with verbose output
docker-compose exec app-service npm test -- --verbose

# Check for port conflicts
docker-compose down -v
docker-compose up -d
docker-compose exec app-service npm test
```

### Issue: Out of memory or file descriptors

```bash
# Increase Docker memory limit and file descriptors
# Edit docker-compose.yml and add:
# services:
#   app-service:
#     mem_limit: 512m

# Or increase system limits
ulimit -n 4096
```

## Advanced Topics

### Scaling the Consumer

For higher throughput, create multiple consumer instances:

```yaml
consumer-1:
  extends: app-service
  environment:
    INSTANCE_ID: consumer-1

consumer-2:
  extends: app-service
  environment:
    INSTANCE_ID: consumer-2
```

All instances in the same consumer group will share the partitions.

### Monitoring and Logging

The service logs all important events:
- Producer: `[Producer] Event published successfully - eventId: ...`
- Consumer: `[Consumer] Event processed - eventId: ...`
- Errors: `[Component] Error message`

### Database Integration (For Production)

To use a real database instead of in-memory storage:

1. Replace `eventStore.js` with a database client
2. Update the consumer to persist events to the database
3. Update the query endpoint to fetch from the database
4. Implement database connection pooling and error handling

## Contributing

When contributing, please:
1. Write tests for new features
2. Follow the existing code style
3. Update documentation
4. Ensure all tests pass

## License

MIT License

## Support

For issues or questions, please refer to the [ARCHITECTURE.md](ARCHITECTURE.md) for more detailed information about the system design.
