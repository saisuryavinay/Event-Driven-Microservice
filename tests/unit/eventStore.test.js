const eventStore = require('../../src/store/eventStore');

describe('EventStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    eventStore.clear();
  });

  describe('storeEvent', () => {
    it('should store a valid event successfully', () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      const result = eventStore.storeEvent(event);

      expect(result.stored).toBe(true);
      expect(result.message).toContain('stored successfully');
      expect(eventStore.getProcessedEventCount()).toBe(1);
    });

    it('should enforce idempotency - duplicate events should not be stored', () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      // First store
      const result1 = eventStore.storeEvent(event);
      expect(result1.stored).toBe(true);

      // Attempt to store the same event again
      const result2 = eventStore.storeEvent(event);
      expect(result2.stored).toBe(false);
      expect(result2.message).toContain('already been processed');
      expect(eventStore.getProcessedEventCount()).toBe(1);
    });

    it('should reject events without eventId', () => {
      const event = {
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      const result = eventStore.storeEvent(event);

      expect(result.stored).toBe(false);
      expect(result.message).toContain('eventId is required');
      expect(eventStore.getProcessedEventCount()).toBe(0);
    });

    it('should reject null events', () => {
      const result = eventStore.storeEvent(null);

      expect(result.stored).toBe(false);
      expect(result.message).toContain('Invalid event');
      expect(eventStore.getProcessedEventCount()).toBe(0);
    });

    it('should store multiple different events', () => {
      const event1 = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      const event2 = {
        eventId: 'test-event-2',
        userId: 'user-2',
        eventType: 'LOGOUT',
        timestamp: '2024-02-14T01:00:00Z',
        payload: {},
      };

      const result1 = eventStore.storeEvent(event1);
      const result2 = eventStore.storeEvent(event2);

      expect(result1.stored).toBe(true);
      expect(result2.stored).toBe(true);
      expect(eventStore.getProcessedEventCount()).toBe(2);
    });
  });

  describe('getAllProcessedEvents', () => {
    it('should return an empty array initially', () => {
      const events = eventStore.getAllProcessedEvents();

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it('should return all stored events', () => {
      const event1 = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: { key: 'value1' },
      };

      const event2 = {
        eventId: 'test-event-2',
        userId: 'user-2',
        eventType: 'PRODUCT_VIEW',
        timestamp: '2024-02-14T01:00:00Z',
        payload: { key: 'value2' },
      };

      eventStore.storeEvent(event1);
      eventStore.storeEvent(event2);

      const events = eventStore.getAllProcessedEvents();

      expect(events.length).toBe(2);
      expect(events[0].eventId).toBe('test-event-1');
      expect(events[1].eventId).toBe('test-event-2');
    });

    it('should return a deep copy of events', () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: { key: 'value' },
      };

      eventStore.storeEvent(event);

      const events = eventStore.getAllProcessedEvents();
      events[0].userId = 'modified-user';

      const eventsAgain = eventStore.getAllProcessedEvents();
      expect(eventsAgain[0].userId).toBe('user-1');
    });
  });

  describe('isEventProcessed', () => {
    it('should return false for unprocessed events', () => {
      const result = eventStore.isEventProcessed('test-event-1');
      expect(result).toBe(false);
    });

    it('should return true for processed events', () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      eventStore.storeEvent(event);
      const result = eventStore.isEventProcessed('test-event-1');

      expect(result).toBe(true);
    });
  });

  describe('getEventById', () => {
    it('should return null for non-existent events', () => {
      const event = eventStore.getEventById('test-event-1');
      expect(event).toBeNull();
    });

    it('should retrieve a stored event by eventId', () => {
      const originalEvent = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      eventStore.storeEvent(originalEvent);
      const retrievedEvent = eventStore.getEventById('test-event-1');

      expect(retrievedEvent).not.toBeNull();
      expect(retrievedEvent.eventId).toBe('test-event-1');
      expect(retrievedEvent.userId).toBe('user-1');
    });
  });

  describe('getProcessedEventCount', () => {
    it('should return 0 initially', () => {
      expect(eventStore.getProcessedEventCount()).toBe(0);
    });

    it('should return the count of stored events', () => {
      const event1 = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      const event2 = {
        eventId: 'test-event-2',
        userId: 'user-2',
        eventType: 'LOGOUT',
        timestamp: '2024-02-14T01:00:00Z',
        payload: {},
      };

      eventStore.storeEvent(event1);
      expect(eventStore.getProcessedEventCount()).toBe(1);

      eventStore.storeEvent(event2);
      expect(eventStore.getProcessedEventCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all stored events', () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      eventStore.storeEvent(event);
      expect(eventStore.getProcessedEventCount()).toBe(1);

      eventStore.clear();
      expect(eventStore.getProcessedEventCount()).toBe(0);
      expect(eventStore.getAllProcessedEvents()).toEqual([]);
    });

    it('should reset idempotency tracking after clear', () => {
      const event = {
        eventId: 'test-event-1',
        userId: 'user-1',
        eventType: 'LOGIN',
        timestamp: '2024-02-14T00:00:00Z',
        payload: {},
      };

      eventStore.storeEvent(event);
      eventStore.clear();

      const result = eventStore.storeEvent(event);
      expect(result.stored).toBe(true);
    });
  });
});
