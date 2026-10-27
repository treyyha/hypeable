/**
 * OpenAI-compatible Chat Completions streams omit `usage` unless the
 * request sets `stream_options.include_usage`. Official docs: OpenAI,
 * DeepSeek, xAI, Groq, and Mistral all require that flag. OpenRouter
 * ignores it (usage is always present). Anthropic and Google do not use
 * this wire format.
 *
 * Only Chat Completions bodies (`messages` + `stream: true`) are patched
 * so the OpenAI Responses API is left alone.
 */
export function injectStreamUsageOption(init?: RequestInit): RequestInit | undefined {
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const body = JSON.parse(init.body) as Record<string, unknown>;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return init;
    }

    if (body.stream !== true || !Array.isArray(body.messages)) {
      return init;
    }

    const existing =
      body.stream_options && typeof body.stream_options === 'object' && !Array.isArray(body.stream_options)
        ? (body.stream_options as Record<string, unknown>)
        : {};

    if (existing.include_usage === true) {
      return init;
    }

    return {
      ...init,
      body: JSON.stringify({
        ...body,
        stream_options: { ...existing, include_usage: true },
      }),
    };
  } catch {
    return init;
  }
}

export function streamUsageFetch(existing?: typeof fetch): typeof fetch {
  const base = existing ?? globalThis.fetch.bind(globalThis);

  return ((input: RequestInfo | URL, init?: RequestInit) => base(input, injectStreamUsageOption(init))) as typeof fetch;
}
