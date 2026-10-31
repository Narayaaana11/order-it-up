import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns true once mounted on client side without triggering cascading re-renders.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

