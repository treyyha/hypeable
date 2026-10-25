import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'Build a personal portfolio' },
  { text: 'Make a recipe finder' },
  { text: 'Build a markdown blog' },
  { text: 'Create a Kanban board in react' },
  { text: 'Make a Pomodoro timer' },
  { text: 'Make a simple landing page' },
  { text: 'Make a slide deck about dogs' },
];

/**
 * Renders a collection of example prompt buttons that users can click to quickly start a conversation.
 *
 * @param sendMessage - Optional callback function to send a message when a prompt is clicked
 * @returns React component displaying example prompt buttons
 */
export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="rounded-full border border-hype-border bg-hype-surface px-3 py-1 text-xs text-hype-muted transition-theme hover:border-hype-accent/40 hover:text-hype-text"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
