# Architecture Documentation

This document provides a detailed overview of the event-driven microservice architecture, design decisions, and implementation patterns.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Details](#component-details)
3. [Event Flow](#event-flow)
4. [Design Patterns](#design-patterns)
5. [Error Handling](#error-handling)
6. [Scalability Considerations](#scalability-considerations)
7. [Security Considerations](#security-considerations)
8. [Future Enhancements](#future-enhancements)

## System Architecture

### Overview Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    External Clients                            │
│              (REST API Consumers / Generators)                 │
└────────────────┬─────────────────────────────────┬────────────┘
                 │                                 │
                 ▼                                 ▼
            ┌────────────┐                  ┌────────────┐
            │   Event    │                  │   Event    │
            │ Generation │                  │   Query    │
            │  Endpoint  │                  │  Endpoint  │
            └────┬───────┘                  └────┬───────┘
                 │                               │
                 │          ┌──────────────────┘
                 │          │
            ┌────▼──────────▼──┐
            │  Express Server  │
            │   (Port 3000)    │
            ├──────────────────┤
            │ Request Handler  │
            │ Validation Layer │
            │ Error Handling   │
            └────┬────────┬────┘
                 │        │
        ┌────────▼──┐ ┌──▼─────────┐
        │ Producer  │ │EventStore   │
        │ Service   │ │ (In-Memory) │
        └────┬──────┘ └──────┬──────┘
             │               │
             │               ▼
             │          ┌──────────────┐
             │          │Idempotency   │
             │          │  Tracker     │
             │          │ (eventId Map)│
             │          └──────────────┘
             │
             ▼
      ┌──────────────────┐
      │   Kafka Broker   │
      │  (Port 9092/     │
      │  29092 internal) │
      │                  │
      │ Topic:           │
      │ user-activity-   │
      │ events           │
      └──────┬───────────┘
             ▲
             │
             │
      ┌──────▼───────────┐
      │   Consumer       │
      │   Service        │
      ├──────────────────┤
      │ Message Handler  │
      │ Validation       │
      │ Deduplication    │
      │ Error Recovery   │
      └────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API Framework** | Express.js 4.18.2 | REST endpoint handling |
| **Message Broker** | Apache Kafka 7.4.0 | Event streaming platform |
| **Coordination** | Apache Zookeeper 7.4.0 | Kafka broker coordination |
| **Runtime** | Node.js 18 | JavaScript runtime |
| **Package Manager** | npm | Dependency management |
| **Testing** | Jest, Supertest | Unit & integration testing |
| **Containerization** | Docker, Docker Compose | Deployment orchestration |

## Component Details

### 1. Express Server (src/index.js)

**Responsibilities:**
- Initialize Kafka producer and consumer
- Start the HTTP server on port 3000
- Handle graceful shutdown
- Provide health check endpoint

**Key Methods:**
- `startApplication()`: Initializes all services and starts the server
- `gracefulShutdown()`: Cleanly closes Kafka connections on termination

**Error Handling:**
- Catches initialization errors and exits with status code 1
- Listens for SIGTERM and SIGINT signals for graceful shutdown

### 2. Configuration Management (src/config.js)

**Purpose:**
- Centralize all configuration management
- Load environment variables with defaults
- Provide configuration validation

**Configuration Categories:**
- Kafka broker settings
- Kafka producer settings (timeout, retries)
- Kafka consumer settings (session timeout, heartbeat interval)
- Application settings (port, environment)

**Benefits:**
- Single source of truth for configuration
- Easy override via environment variables
- Type-safe access to settings

### 3. Kafka Producer (src/producer.js)

**Responsibilities:**
- Establish and maintain connection to Kafka broker
- Publish events to the `user-activity-events` topic
- Handle publish failures with retry logic
- Provide connection status information

**Key Features:**
- **Idempotent Writes**: Configured to ensure exactly-once semantics
- **Compression**: Gzip compression for message payload
- **Partitioning**: Events partitioned by userId for ordered processing
- **Error Handling**: Retry logic with exponential backoff
- **Graceful Disconnect**: Proper cleanup of Kafka connection

**Implementation Details:**

```javascript
// Producer configuration
{
  timeout: 30000,           // 30 seconds
  retries: 3,              // 3 retry attempts
  idempotent: true,        // Exactly-once semantics
  compression: 1           // Gzip compression
}
```

**Message Structure Published to Kafka:**
```json
{
  "key": "user-id",         // Partition key
  "value": {
    "eventId": "uuid",
    "userId": "string",
    "eventType": "string",
    "timestamp": "ISO-8601",
    "payload": {}
  },
  "headers": {
    "event-type": "string",
    "event-id": "string"
  }
}
```

### 4. Kafka Consumer (src/consumer.js)

**Responsibilities:**
- Connect to Kafka broker as part of consumer group
- Subscribe to `user-activity-events` topic
- Process incoming events
- Handle malformed or invalid messages
- Maintain consumer group offset

**Key Features:**
- **Consumer Group**: Part of `user-activity-consumer-group` for distributed processing
- **Message Validation**: Validates JSON structure and event fields
- **Error Resilience**: Continues processing even if individual messages fail
- **Graceful Handling**: Skips malformed messages without crashing

**Configuration:**
```javascript
{
  groupId: 'user-activity-consumer-group',
  sessionTimeout: 30000,       // Consumer must heartbeat within 30s
  heartbeatInterval: 3000,     // Heartbeat every 3 seconds
  fromBeginning: false         // Start from latest offset
}
```

**Processing Pipeline:**
1. Receive message from Kafka
2. Parse JSON payload
3. Validate message structure
4. Check idempotency (eventId already processed?)
5. Store in event store
6. Log for monitoring

### 5. Event Store (src/store/eventStore.js)

**Responsibilities:**
- Store processed events in memory
- Track processed event IDs for idempotency
- Provide query interface for processed events
- Maintain data consistency

**Data Structure:**
```javascript
{
  processedEventIds: Map<eventId, true>,    // O(1) lookup
  processedEvents: Array<UserEvent>         // Ordered list
}
```

**Idempotency Mechanism:**
- Uses a Map to track processed eventIds
- O(1) lookup time for duplicate detection
- Prevents duplicate storage without requiring external locks

**Methods:**
- `storeEvent(event)`: Store with idempotency check
- `isEventProcessed(eventId)`: Check if already processed
- `getAllProcessedEvents()`: Get all stored events
- `getEventById(eventId)`: Retrieve specific event
- `clear()`: Clear all data (testing only)

### 6. Event Model and Validation (src/models/userEvent.js)

**Event Schema:**
```json
{
  "eventId": "uuid-string",
  "userId": "string",
  "eventType": "LOGIN | LOGOUT | PRODUCT_VIEW",
  "timestamp": "ISO-8601-string",
  "payload": {}
}
```

**Validation Functions:**
- `validateUserEvent()`: Validate partial event (input validation)
- `validateCompleteUserEvent()`: Validate complete event (Kafka message validation)
- `createUserEvent()`: Create and validate new event

**Constraints:**
- `eventId`: Required, UUID format, unique
- `userId`: Required, non-empty string
- `eventType`: Required, must be predefined value
- `timestamp`: ISO-8601 format string
- `payload`: Optional, must be JSON object if provided

### 7. API Routes (src/api/routes.js)

**Endpoints:**

#### POST /events/generate
- Accepts partial event payload
- Validates input
- Generates eventId and timestamp
- Publishes to Kafka
- Returns 201 with complete event or error

#### GET /events/processed
- Returns all events from event store
- Returns JSON array
- No query parameters supported

**Response Format:**
```json
{
  "success": boolean,
  "event": UserEvent | null,
  "errors": string[] | null,
  "error": string | null
}
```

## Event Flow

### End-to-End Event Processing

```
1. Client Request
   ↓
   POST /events/generate
   {userId, eventType, payload}
   ↓
2. API Server (routes.js)
   ├─ Validate input
   ├─ Generate eventId (UUID)
   ├─ Set timestamp (ISO-8601)
   └─ Create UserEvent object
   ↓
3. Producer (producer.js)
   ├─ Format message
   ├─ Publish to Kafka topic
   ├─ Handle retries
   └─ Return result
   ↓
4. Kafka Topic: user-activity-events
   ├─ Message persisted
   ├─ Replicated (if configured)
   └─ Consumer begins reading
   ↓
5. Consumer (consumer.js)
   ├─ Receive message
   ├─ Parse JSON
   ├─ Validate structure
   ├─ Check idempotency
   └─ Process event
   ↓
6. Event Store (eventStore.js)
   ├─ Check if already processed
   ├─ Store if new
   └─ Return status
   ↓
7. Client Query
   ↓
   GET /events/processed
   ↓
8. API Server
   ├─ Query event store
   └─ Return all events
   ↓
9. Response: JSON array of UserEvents
```

### Message Journey Through Kafka

```
Producer Publishes:
  Time: T
  Key: "user-123"
  Value: {eventId: "uuid-1", ...}
  ↓
Kafka Broker:
  ├─ Partition 0: [other messages]
  ├─ Partition N: [other messages]
  └─ Topic Partition: Stores message
     Offset: 1000
  ↓
Consumer Group: user-activity-consumer-group
  ├─ Instance 1: Reading partitions 0-2
  ├─ Instance 2: Reading partitions 3-5
  └─ Commits offset: 1000
  ↓
Consumer Processes:
  Time: T+100ms
  Message received
  ↓
Event Stored:
  In-Memory Store
  processedEventIds["uuid-1"] = true
```

## Design Patterns

### 1. Singleton Pattern

**Usage**: KafkaProducer, KafkaConsumer, EventStore

**Benefit**: Single instance across application, guaranteed consistency

```javascript
module.exports = new KafkaProducer();  // Singleton instance
```

### 2. Factory Pattern

**Usage**: Event creation in routes/models

```javascript
function createUserEvent(eventData) {
  return {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    ...eventData
  };
}
```

### 3. Observer Pattern (Event-Driven)

**Usage**: Kafka producer-consumer relationship

- Producer publishes events
- Multiple consumers can subscribe
- Decoupled communication

### 4. Command Pattern

**Usage**: Message handling in consumer

```javascript
await consumer.handleMessage(kafkaMessage);  // Execute command
```

### 5. Validation Pattern

**Usage**: Event schema validation

```javascript
const validation = validateUserEvent(input);
if (!validation.valid) {
  return { errors: validation.errors };
}
```

## Error Handling

### Producer Error Handling

```javascript
try {
  const result = await this.producer.send({...});
  return { success: true, eventId };
} catch (error) {
  console.error('[Producer] Failed:', error.message);
  return { success: false, error: error.message };
}
```

**Error Types Handled:**
- Network timeouts
- Broker unavailability
- Message serialization errors
- Partition full (rare)

**Recovery Strategy:**
- Retry with exponential backoff
- Log detailed error information
- Return error to caller for user feedback

### Consumer Error Handling

```javascript
async handleMessage(message) {
  try {
    const event = JSON.parse(message.value.toString());  // Parse error
    validateCompleteUserEvent(event);                    // Validation error
    eventStore.storeEvent(event);                        // Storage error
  } catch (error) {
    console.error('[Consumer] Error:', error.message);
    // Skip malformed message, continue processing
  }
}
```

**Error Types Handled:**
- Malformed JSON
- Invalid event structure
- Missing required fields
- Type mismatches

**Recovery Strategy:**
- Log error with context
- Skip problematic message
- Continue processing next message
- Don't crash the consumer

### API Error Response

```javascript
// Input validation error
400 Bad Request: { success: false, errors: [...] }

// Kafka publish failure
500 Internal Server Error: { success: false, error: "..." }

// Server error
500 Internal Server Error: { success: false, error: "Internal server error" }
```

## Scalability Considerations

### Horizontal Scaling

**Consumer Instances:**
- Add more consumer instances to same group
- Kafka automatically rebalances partitions
- Each instance helps more messages in parallel

```yaml
consumers:
  consumer-1:
    extends: app-service
  consumer-2:
    extends: app-service
  consumer-3:
    extends: app-service
```

**Load Balancing:**
- Use reverse proxy (nginx, HAProxy) for API
- Distribute requests across producer instances

### Partitioning Strategy

**Current**: Single partition would work for small scale

**For Scaling**:
```bash
# Create topic with multiple partitions
kafka-topics.sh --create \
  --topic user-activity-events \
  --partitions 10 \
  --replication-factor 3
```

**Benefits:**
- Parallel processing across partitions
- Ordered processing per partition (by userId)
- Higher throughput

### Event Store Scaling

**Current**: In-memory storage

**Production Options:**
1. **SQL Database**: PostgreSQL, MySQL
   - ACID transactions
   - Rich query capabilities

2. **NoSQL Database**: MongoDB, DynamoDB
   - Better horizontal scaling
   - Flexible schema

3. **Cache + Database**: Redis + PostgreSQL
   - Hot data in cache
   - Cold data in database

4. **Time-Series Database**: InfluxDB, TimescaleDB
   - Optimized for time-series events
   - Excellent compression

### Performance Optimization

1. **Batch Processing**:
```javascript
// Process messages in batches
const messages = await consumer.fetch({ maxWaitTime: 100 });
```

2. **Connection Pooling**:
```javascript
// Reuse Kafka connections
const kafka = new Kafka({
  connectionTimeout: 10000,
  requestTimeout: 30000
});
```

3. **Compression**:
```javascript
// Gzip compression for network bandwidth
{ compression: 1 }  // 1 = Gzip
```

4. **Async Processing**:
- Non-blocking I/O
- Concurrent message handling

## Security Considerations

### 1. Input Validation

**Current Implementation:**
- All inputs validated against schema
- Type checking for all fields
- Enum validation for eventType

**Recommendations:**
```javascript
// Add more constraints
- Max length for string fields
- Max size for JSON payloads
- Rate limiting on endpoints
```

### 2. Kafka Security

**Current**: No authentication (localhost development)

**Production Setup:**
```yaml
KAFKA_SECURITY_PROTOCOL: SASL_SSL
KAFKA_SASL_MECHANISM: PLAIN
KAFKA_SASL_USERNAME: <username>
KAFKA_SASL_PASSWORD: <password>
```

### 3. API Security

**Missing in Current:**
- Authentication/Authorization
- HTTPS/TLS
- Request size limits
- CORS headers

**Add to Express:**
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());           // Security headers
app.use(rateLimit({...}));   // Rate limiting
```

### 4. Environment Variables

**Current**: Stored in .env files

**Best Practices:**
- Never commit .env files
- Use secret management (AWS Secrets, Azure KeyVault)
- Rotate secrets regularly
- Audit access logs

### 5. Data Privacy

**Considerations:**
- Log sensitive data carefully
- Implement data masking
- Add data retention policies
- Comply with GDPR/CCPA

## Future Enhancements

### 1. Dead Letter Queue (DLQ)

**Purpose**: Handle messages that fail processing repeatedly

```javascript
// Send to DLQ topic after max retries
if (retryCount >= MAX_RETRIES) {
  await producer.send({
    topic: 'user-activity-events-dlq',
    messages: [{ value: originalMessage }]
  });
}
```

### 2. Schema Registry

**Purpose**: Enforce event schema versioning

```javascript
// Use Confluent Schema Registry or similar
const schema = await schemaRegistry.getLatestSchema('user-activity-events');
```

### 3. Event Sourcing

**Purpose**: Complete event history as source of truth

```javascript
// Store all events
// Rebuild state from events
class EventSource {
  getEventsSince(timestamp) {
    return eventStore.query({createdAt: {$gte: timestamp}});
  }
}
```

### 4. CQRS (Command Query Responsibility Segregation)

**Purpose**: Separate read and write models

```javascript
// Write model: Kafka producer
// Read model: Materialized view in database
class ReadModel {
  async getProcessedEventsByUser(userId) {
    return database.query({userId});
  }
}
```

### 5. Metrics and Monitoring

```javascript
// Add Prometheus metrics
const promClient = require('prom-client');

const messagesPublished = new promClient.Counter({
  name: 'messages_published_total',
  help: 'Total messages published'
});

const processedEventsGauge = new promClient.Gauge({
  name: 'processed_events',
  help: 'Current processed events count'
});
```

### 6. Distributed Tracing

```javascript
// Use OpenTelemetry for request tracing
const {BasicTracerProvider} = require("@opentelemetry/tracing");

const provider = new BasicTracerProvider();
const tracer = provider.getTracer('app-tracer');

const span = tracer.startSpan('handleMessage');
// ... processing ...
span.end();
```

### 7. Circuit Breaker Pattern

```javascript
// Prevent cascading failures
class CircuitBreaker {
  async execute(fn) {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is open');
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### 8. Kafka Schema Evolution

**Current**: Fixed schema

**Evolution Strategy:**
```javascript
// Version events for backward compatibility
{
  "version": "1.0",
  "eventId": "...",
  "userId": "...",
  // ... other fields
  "_metadata": {
    "schema_version": "1.0",
    "migrated_at": "2024-02-14T..."
  }
}
```

### 9. Multi-Tenancy Support

```javascript
// Tenant awareness in events
{
  "tenantId": "client-123",
  "userId": "user-456",
  "eventType": "LOGIN",
  // ...
}

// Partition by tenant for isolation
const partition = tenantId + '-' + (hash(userId) % numPartitions);
```

### 10. Analytics and Dashboards

```javascript
// Stream events to analytics systems
// Kafka -> Elasticsearch -> Kibana
// Kafka -> BigQuery -> Data Studio
```

## Conclusion

This event-driven microservice provides a solid foundation for building scalable, resilient distributed systems. The modular design allows for easy extension and integration with additional components as requirements evolve.

For questions or clarifications, refer to the main [README.md](README.md) or review the inline code comments.
