import { Chip } from '~/components/ui/Chip';

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
 * Equal-width 2×2 on narrow screens; four columns on wider, one line each.
 */
export function ExamplePrompts({ onFill, limit = 4 }: { onFill: (text: string) => void; limit?: number }) {
  return (
    <div id="examples" data-testid="example-prompts" className="relative mx-auto mt-4 w-full max-w-[720px] px-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EXAMPLE_PROMPTS.slice(0, limit).map((examplePrompt) => {
          return (
            <Chip
              key={examplePrompt.text}
              type="button"
              title={examplePrompt.text}
              className="hype-chip--block"
              onClick={() => {
                onFill(examplePrompt.text);
              }}
            >
              {examplePrompt.text}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
