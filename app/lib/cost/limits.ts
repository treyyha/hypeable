/** Official provider spending-limit dashboards. Caps in this app are local. */
export const PROVIDER_SPENDING_LIMITS = [
  { name: 'Anthropic', href: 'https://console.anthropic.com/settings/limits' },
  { name: 'OpenAI', href: 'https://platform.openai.com/settings/organization/limits' },
  { name: 'Google', href: 'https://aistudio.google.com/usage' },
  { name: 'OpenRouter', href: 'https://openrouter.ai/settings/credits' },
  { name: 'DeepSeek', href: 'https://platform.deepseek.com/usage' },
  { name: 'Groq', href: 'https://console.groq.com/settings/billing' },
  { name: 'xAI', href: 'https://console.x.ai' },
  { name: 'Mistral', href: 'https://console.mistral.ai/usage' },
] as const;
