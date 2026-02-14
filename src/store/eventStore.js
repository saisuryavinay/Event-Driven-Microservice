/**
 * EventStore - In-memory store for processed events with idempotency support
 * Ensures that each event (identified by eventId) is processed and stored only once
 */
class EventStore {
  constructor() {
    // Map to track processed event IDs (for idempotency)
    this.processedEventIds = new Map();
    // Array to store all processed events
    this.processedEvents = [];
  }

  /**
   * Checks if an event has already been processed
   * @param {string} eventId - The unique event ID
   * @returns {boolean} - True if the event has been processed, false otherwise
   */
  isEventProcessed(eventId) {
    return this.processedEventIds.has(eventId);
  }

  /**
   * Stores an event in the in-memory store
   * Implements idempotency by checking if the event has already been processed
   * @param {Object} event - The UserEvent object
   * @returns {Object} - Returns { stored: boolean, message: string }
   */
  storeEvent(event) {
    if (!event || !event.eventId) {
      return {
        stored: false,
        message: 'Invalid event: eventId is required',
      };
    }

    if (this.isEventProcessed(event.eventId)) {
      return {
        stored: false,
        message: `Event ${event.eventId} has already been processed (idempotency)`,
      };
    }

    try {
      this.processedEventIds.set(event.eventId, true);
      this.processedEvents.push({
        eventId: event.eventId,
        userId: event.userId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        payload: event.payload,
      });

      return {
        stored: true,
        message: `Event ${event.eventId} stored successfully`,
      };
    } catch (error) {
      return {
        stored: false,
        message: `Failed to store event: ${error.message}`,
      };
    }
  }

  /**
   * Retrieves all processed events
   * @returns {Array} - Array of processed UserEvent objects
   */
  getAllProcessedEvents() {
    return JSON.parse(JSON.stringify(this.processedEvents));
  }

  /**
   * Retrieves count of processed events
   * @returns {number} - Number of unique processed events
   */
  getProcessedEventCount() {
    return this.processedEvents.length;
  }

  /**
   * Clears all stored events (useful for testing)
   */
  clear() {
    this.processedEventIds.clear();
    this.processedEvents = [];
  }

  /**
   * Retrieves a specific event by eventId
   * @param {string} eventId - The unique event ID
   * @returns {Object|null} - The event if found, null otherwise
   */
  getEventById(eventId) {
    return (
      this.processedEvents.find((event) => event.eventId === eventId) || null
    );
  }
}

module.exports = new EventStore();
