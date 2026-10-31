/**
 * Home-composer presentation copy. Kept as pure strings so first-load
 * placeholders and estimate chips stay consistent in tests.
 */

export const FIRST_BUILD_PLACEHOLDER = 'Describe your app, e.g. a habit tracker with streaks and dark mode';
export const DISCUSS_PLACEHOLDER = 'What would you like to discuss?';
export const COMPOSER_SHORTCUT_HINT = 'Enter to send · Shift+Enter for a new line';

export function composerPlaceholder(chatMode: 'discuss' | 'build' | undefined): string {
  return chatMode === 'discuss' ? DISCUSS_PLACEHOLDER : FIRST_BUILD_PLACEHOLDER;
}

export function planEstimateCopy(unknown: boolean, formattedAmount: string): { text: string; title: string } {
  if (unknown) {
    return {
      text: 'price unknown',
      title: 'No list price for this model. Set a custom price in Settings to estimate.',
    };
  }

  return {
    text: `about ${formattedAmount}`,
    title: `Estimated planning cost ${formattedAmount}`,
  };
}
