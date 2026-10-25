/**
 * Plan text is shown as plain text only. Never interpret HTML from the model.
 */

export function asPlainText(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}
