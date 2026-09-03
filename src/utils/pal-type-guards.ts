/**
 * Type guards for proper discrimination between local and NovaHub pals
 *
 * These utilities provide type-safe ways to distinguish between different pal types
 * without relying on fragile property existence checks.
 */

import type {Pal} from '../types/pal';
import type {NovaHubPal} from '../types/novahub';

/**
 * Type guard to check if a pal is a local pal
 */
export function isLocalPal(pal: Pal | NovaHubPal): pal is Pal {
  return pal.type === 'local';
}

/**
 * Type guard to check if a pal is a NovaHub pal
 */
export function isNovaHubPal(pal: Pal | NovaHubPal): pal is NovaHubPal {
  return pal.type === 'novahub';
}

/**
 * Union type for all pal types
 */
export type AnyPal = Pal | NovaHubPal;

/**
 * Type-safe pal handler that ensures proper type discrimination
 */
export interface PalHandlers {
  onLocalPal: (pal: Pal) => void;
  onNovaHubPal: (pal: NovaHubPal) => void;
}

/**
 * Handle a pal with type-safe discrimination
 */
export function handlePalByType(pal: AnyPal, handlers: PalHandlers): void {
  if (isLocalPal(pal)) {
    handlers.onLocalPal(pal);
  } else if (isNovaHubPal(pal)) {
    handlers.onNovaHubPal(pal);
  } else {
    console.warn('Unknown pal type:', pal);
  }
}
