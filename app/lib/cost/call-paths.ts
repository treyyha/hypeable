/**
 * Every code path that calls a model must report to the meter.
 * Tests import this table so a new LLM call site cannot land without a row.
 */
export const METERED_CALL_PATHS = [
  {
    id: 'chat',
    route: '/api/chat',
    callKind: 'chat',
    transport: 'data-usage',
    notes: 'Main streamText onEnd, including continuation segments.',
  },
  {
    id: 'plan',
    route: '/api/chat',
    callKind: 'plan',
    transport: 'data-usage',
    notes: 'Same stream as chat when planMode is on.',
  },
  {
    id: 'summary',
    route: '/api/chat',
    callKind: 'summary',
    transport: 'data-usage',
    notes: 'createSummary generateText nested in /api/chat.',
  },
  {
    id: 'context',
    route: '/api/chat',
    callKind: 'context',
    transport: 'data-usage',
    notes: 'selectContext generateText nested in /api/chat.',
  },
  {
    id: 'retry',
    route: '/api/chat',
    callKind: 'chat',
    transport: 'data-usage',
    notes: 'Loop-breaker replans and retries are new /api/chat turns.',
  },
  {
    id: 'enhancer',
    route: '/api/enhancer',
    callKind: 'enhancer',
    transport: 'usage-marker',
    notes: 'wrapTextStreamWithUsage appends a marker; aborted streams emit ≈.',
  },
  {
    id: 'llmcall-stream',
    route: '/api/llmcall',
    callKind: 'llmcall',
    transport: 'usage-marker',
    notes: 'Streaming mode uses the same usage marker as the enhancer.',
  },
  {
    id: 'llmcall-json',
    route: '/api/llmcall',
    callKind: 'llmcall',
    transport: 'json-usage',
    notes: 'Non-streaming JSON includes result.totalUsage via toLlmCallResponse.',
  },
] as const;
