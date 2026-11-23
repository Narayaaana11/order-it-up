/**
 * Aggregator Adapter Interface & Registry
 *
 * Provides a standardized adapter interface for outbound delivery partner actions
 * (accept, ready, reject, dispatch) to Swiggy, Zomato, or Direct delivery channels.
 */

export interface AggregatorActionPayload {
  prep_time_minutes?: number;
  reason?: string;
  [key: string]: any;
}

export interface AggregatorActionResult {
  success: boolean;
  external_reference?: string;
  error?: string;
  timestamp?: string;
}

export interface AggregatorAdapter {
  readonly platform: 'swiggy' | 'zomato' | 'direct';
  acceptOrder(externalOrderId: string, prepTimeMinutes: number): Promise<AggregatorActionResult>;
  rejectOrder(externalOrderId: string, reason: string): Promise<AggregatorActionResult>;
  markFoodReady(externalOrderId: string): Promise<AggregatorActionResult>;
  dispatchOrder(externalOrderId: string): Promise<AggregatorActionResult>;
}

const adapterRegistry = new Map<string, AggregatorAdapter>();

export function registerAggregatorAdapter(adapter: AggregatorAdapter): void {
  adapterRegistry.set(adapter.platform.toLowerCase(), adapter);
}

export function getAggregatorAdapter(platform: string): AggregatorAdapter | undefined {
  return adapterRegistry.get(platform.toLowerCase());
}

export function removeAggregatorAdapter(platform: string): boolean {
  return adapterRegistry.delete(platform.toLowerCase());
}

export function resetAggregatorAdapters(): void {
  adapterRegistry.clear();
}

export function listRegisteredAggregatorPlatforms(): string[] {
  return Array.from(adapterRegistry.keys());
}
