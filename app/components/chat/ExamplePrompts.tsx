import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'Make a recipe finder' },
  { text: 'Build a markdown blog' },
  { text: 'Make a Pomodoro timer' },
  { text: 'Make a simple landing page' },
  { text: 'Build a personal portfolio' },
  { text: 'Create a Kanban board in react' },
  { text: 'Make a slide deck about dogs' },
];

/**
 * Example chips fill the composer. They do not send — the user still hits Enter.
 */
export function ExamplePrompts({ onFill, limit = 4 }: { onFill: (text: string) => void; limit?: number }) {
  return (
    <div
      id="examples"
      data-testid="example-prompts"
      className="relative mx-auto mt-4 flex w-full max-w-2xl justify-center"
    >
      <div className="flex flex-wrap justify-center gap-2 px-1 sm:flex-nowrap">
        {EXAMPLE_PROMPTS.slice(0, limit).map((examplePrompt) => {
          return (
            <button
              key={examplePrompt.text}
              type="button"
              onClick={() => {
                onFill(examplePrompt.text);
              }}
              className="appearance-none rounded-full border border-hype-border bg-hype-surface px-3 py-1 text-xs text-hype-muted transition-theme hover:text-hype-text"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
