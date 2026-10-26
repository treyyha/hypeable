/**
 * Quiet disclosure under the home suggestions. Templates and import
 * actions stay reachable without crowding the first screen.
 */
import type { UIMessage } from 'ai';
import { useState } from 'react';
import GitCloneButton from '~/components/chat/GitCloneButton';
import { ImportFolderButton } from '~/components/chat/ImportFolderButton';
import { ImportZipButton } from '~/components/chat/ImportZipButton';
import { Chip } from '~/components/ui/Chip';
import { classNames } from '~/utils/classNames';
import { STARTER_TEMPLATES } from '~/utils/constants';

type MoreWaysToStartProps = {
  importChat?: (description: string, messages: UIMessage[]) => Promise<void>;
};

export function MoreWaysToStart({ importChat }: MoreWaysToStartProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 text-center">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="appearance-none border-0 bg-transparent px-1 py-0.5 text-xs text-hype-muted hover:text-hype-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
      >
        More ways to start: Templates . Import folder . Import ZIP . Clone repo
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            {STARTER_TEMPLATES.slice(0, 8).map((template) => (
              <Chip
                key={template.name}
                onClick={() => (window.location.href = `/starter?template=${encodeURIComponent(template.name)}`)}
              >
                {template.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <ImportFolderButton
              importChat={importChat}
              className={classNames(
                'gap-2 bg-bolt-elements-background-depth-1',
                'text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-background-depth-2',
                'h-10 px-4 py-2 min-w-[120px] justify-center',
                'transition-all duration-200 ease-in-out rounded-lg',
              )}
            />
            <ImportZipButton
              importChat={importChat}
              className={classNames(
                'gap-2 bg-bolt-elements-background-depth-1',
                'text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-background-depth-2',
                'h-10 px-4 py-2 min-w-[120px] justify-center',
                'transition-all duration-200 ease-in-out rounded-lg',
              )}
            />
            <GitCloneButton importChat={importChat} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
