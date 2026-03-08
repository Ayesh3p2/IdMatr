export interface EventMessage<T = any> {
  id: string;
  timestamp: Date;
  source: string;
  type: string;
  data: T;
}

export interface IEventBus {
  publish(event: EventMessage): Promise<void>;
  subscribe(type: string, handler: (event: EventMessage) => Promise<void>): Promise<void>;
}

export class KafkaEventBus implements IEventBus {
  async publish(event: EventMessage): Promise<void> {
    console.log(`[EventBus] Publishing event: ${event.type}`, event.data);
  }

  async subscribe(type: string, handler: (event: EventMessage) => Promise<void>): Promise<void> {
    console.log(`[EventBus] Subscribed to event: ${type}`);
  }
}
