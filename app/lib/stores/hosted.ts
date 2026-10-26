/**
 * Client mirror of HYPEABLE_HOSTED. Set from the root loader; never trust a
 * client-sent value for enforcement — routes still check the server env.
 */
import { atom } from 'nanostores';

export const hostedModeStore = atom(false);

export function setHostedMode(value: boolean): void {
  hostedModeStore.set(value);
}
