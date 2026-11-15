export type DemoEvent = {
  type: string;
  data?: Record<string, unknown>;
  createdAt: string;
};

type Listener = (event: DemoEvent) => void;
const listeners = new Set<Listener>();

export function emitDemoEvent(type: string, data: Record<string, unknown> = {}): void {
  const event: DemoEvent = { type, data, createdAt: new Date().toISOString() };
  for (const listener of listeners) listener(event);
}

export function subscribeDemoEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
