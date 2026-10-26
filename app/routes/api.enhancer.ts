import type { UIMessage } from 'ai';
import type { ActionFunctionArgs } from 'react-router';
import { toApiErrorResponse, toMissingCredentialError, toSafeTextStream } from '~/lib/.server/api/errors';
import { readJsonBody } from '~/lib/.server/api/read-body';
import { REQUEST_LIMITS, enhancerRequestSchema, parseBody } from '~/lib/.server/api/schemas';
import { providerHasCredential } from '~/lib/.server/llm/credentials';
import { streamText } from '~/lib/.server/llm/stream-text';
import { getProviderSettingsFromRequest } from '~/lib/api/provider-settings';
import { getApiKeysFromRequest, LLM_NO_STORE_HEADERS, missingProviderKeyResponse } from '~/lib/api/request-keys';
import { usageFromResult, wrapTextStreamWithUsage } from '~/lib/cost/stream-usage';
import { createMessage } from '~/lib/persistence/messageMigration';
import { envFromContext, hostFromContext } from '~/lib/security/hosted';
import { assertHostedProviderAccess, hostedOutboundResponse } from '~/lib/security/outbound';
import { stripIndents } from '~/utils/stripIndent';

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  /*
   * `provider` used to be destructured from an unvalidated body, so `{ provider: {} }`
   * threw a TypeError reading `.name` and surfaced as a 500. Validated up front now.
   */
  let body;
  let rawBody: unknown;

  try {
    rawBody = await readJsonBody(request, { maxBytes: REQUEST_LIMITS.MAX_LLMCALL_BODY_BYTES });

    body = parseBody(enhancerRequestSchema, rawBody, 'enhancer');
  } catch (error) {
    return toApiErrorResponse(error);
  }

  const { message, model } = body;
  const providerName = body.provider.name;

  const apiKeys = getApiKeysFromRequest(request, rawBody);
  const providerSettings = getProviderSettingsFromRequest(request);

  try {
    assertHostedProviderAccess(
      envFromContext(context),
      providerName,
      providerSettings[providerName]?.baseUrl,
      hostFromContext(context),
    );
  } catch (error) {
    const rejected = hostedOutboundResponse(error);

    if (rejected) {
      return rejected;
    }

    throw error;
  }

  if (!providerHasCredential(providerName, apiKeys, context.cloudflare?.env)) {
    return missingProviderKeyResponse(providerName);
  }

  try {
    const result = await streamText({
      messages: [
        createMessage({
          role: 'user',
          text:
            `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n` +
            stripIndents`
            You are a professional prompt engineer specializing in crafting precise, effective prompts.
            Your task is to enhance prompts by making them more specific, actionable, and effective.

            I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

            For valid prompts:
            - Make instructions explicit and unambiguous
            - Add relevant context and constraints
            - Remove redundant information
            - Maintain the core intent
            - Ensure the prompt is self-contained
            - Use professional language

            For invalid or unclear prompts:
            - Respond with clear, professional guidance
            - Keep responses concise and actionable
            - Maintain a helpful, constructive tone
            - Focus on what the user should provide
            - Use a standard template for consistency

            IMPORTANT: Your response must ONLY contain the enhanced prompt text.
            Do not include any explanations, metadata, or wrapper tags.

            <original_prompt>
              ${message}
            </original_prompt>
          `,
        }) as unknown as Omit<UIMessage, 'id'>,
      ],
      env: context.cloudflare?.env as any,
      apiKeys,
      providerSettings,
      options: {
        system:
          'You are a senior software principal architect, you should help the user analyse the user query and enrich it with the necessary context and constraints to make it more specific, actionable, and effective. You should also ensure that the prompt is self-contained and uses professional language. Your response should ONLY contain the enhanced prompt text. Do not include any explanations, metadata, or wrapper tags.',

        /*
         * onError: (event) => {
         *   throw new Response(null, {
         *     status: 500,
         *     statusText: 'Internal Server Error',
         *   });
         * }
         */
      },
    });

    return new Response(
      toSafeTextStream(
        wrapTextStreamWithUsage(result.textStream, usageFromResult(result), { model, provider: providerName }),
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          ...LLM_NO_STORE_HEADERS,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('API key')) {
      return toApiErrorResponse(toMissingCredentialError(providerName, error.message));
    }

    return toApiErrorResponse(error, providerName);
  }
}
