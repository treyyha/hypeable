/**
 * WARN: prices/amounts from the request body fed into payment calls. Heuristic.
 */

import { isServerHandlerPath, linesOf, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const BODY_PRICE = /(?:req|request|body)\.(?:body\.)?(price|amount|unit_amount|total)\b/i;
const PAYMENT = /\b(stripe|paypal|square|paddle|lemonsqueezy|charges?\.create|paymentintents?|checkout\.sessions)\b/i;

export const clientPriceTrustRule: PredeployRule = {
  id: 'client-price-trust',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    for (const [file, content] of Object.entries(files)) {
      if (!isServerHandlerPath(file) && !PAYMENT.test(content)) {
        continue;
      }

      if (!PAYMENT.test(content)) {
        continue;
      }

      const lines = linesOf(content);

      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index] ?? '';

        if (!BODY_PRICE.test(text)) {
          continue;
        }

        findings.push(
          makeFinding(clientPriceTrustRule, {
            file,
            line: index + 1,
            maskedSnippet: text.trim().slice(0, 160),
            why: 'A price or amount from the request body is used in a payment call.',
            fix: 'Look up price on the server from a product id. Never trust client-sent amounts.',
          }),
        );
      }
    }

    return findings;
  },
};
