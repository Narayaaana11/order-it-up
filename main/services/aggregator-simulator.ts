/**
 * Aggregator Simulator & Mock Adapter
 *
 * In-memory test and local development simulator for Swiggy and Zomato outbound APIs.
 * Supports configurable simulated errors, latency, and event recording for automated testing.
 */

import {
  AggregatorAdapter,
  AggregatorActionResult,
  registerAggregatorAdapter,
} from './aggregator-adapter';

export interface RecordedAggregatorAction {
  platform: string;
  action: 'accept' | 'ready' | 'reject' | 'dispatch';
  externalOrderId: string;
  payload: any;
  timestamp: string;
  success: boolean;
  error?: string;
}

export class MockAggregatorAdapter implements AggregatorAdapter {
  public readonly platform: 'swiggy' | 'zomato' | 'direct';
  private failures: Map<string, string> = new Map();
  private recordedActions: RecordedAggregatorAction[] = [];
  private latencyMs: number = 0;

  constructor(platform: 'swiggy' | 'zomato' | 'direct') {
    this.platform = platform;
  }

  setSimulatedFailure(action: 'accept' | 'ready' | 'reject' | 'dispatch', errorMessage?: string): void {
    if (errorMessage) {
      this.failures.set(action, errorMessage);
    } else {
      this.failures.delete(action);
    }
  }

  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  getRecordedActions(): RecordedAggregatorAction[] {
    return [...this.recordedActions];
  }

  clearRecordedActions(): void {
    this.recordedActions = [];
    this.failures.clear();
    this.latencyMs = 0;
  }

  private async execute(
    action: 'accept' | 'ready' | 'reject' | 'dispatch',
    externalOrderId: string,
    payload: any,
  ): Promise<AggregatorActionResult> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    const failureError = this.failures.get(action);
    const nowTs = new Date().toISOString();

    if (failureError) {
      this.recordedActions.push({
        platform: this.platform,
        action,
        externalOrderId,
        payload,
        timestamp: nowTs,
        success: false,
        error: failureError,
      });
      return { success: false, error: failureError, timestamp: nowTs };
    }

    this.recordedActions.push({
      platform: this.platform,
      action,
      externalOrderId,
      payload,
      timestamp: nowTs,
      success: true,
    });

    return {
      success: true,
      external_reference: `${this.platform.toUpperCase()}-ACK-${Date.now()}`,
      timestamp: nowTs,
    };
  }

  async acceptOrder(externalOrderId: string, prepTimeMinutes: number): Promise<AggregatorActionResult> {
    return this.execute('accept', externalOrderId, { prep_time_minutes: prepTimeMinutes });
  }

  async rejectOrder(externalOrderId: string, reason: string): Promise<AggregatorActionResult> {
    return this.execute('reject', externalOrderId, { reason });
  }

  async markFoodReady(externalOrderId: string): Promise<AggregatorActionResult> {
    return this.execute('ready', externalOrderId, {});
  }

  async dispatchOrder(externalOrderId: string): Promise<AggregatorActionResult> {
    return this.execute('dispatch', externalOrderId, {});
  }
}

// Global default mock adapters
export const swiggyMockAdapter = new MockAggregatorAdapter('swiggy');
export const zomatoMockAdapter = new MockAggregatorAdapter('zomato');
export const directMockAdapter = new MockAggregatorAdapter('direct');

export function initAggregatorSimulators(): void {
  registerAggregatorAdapter(swiggyMockAdapter);
  registerAggregatorAdapter(zomatoMockAdapter);
  registerAggregatorAdapter(directMockAdapter);
}
