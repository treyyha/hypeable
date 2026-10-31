import { useStore } from '@nanostores/react';
import { generateId, type UIMessage } from 'ai';
import ignore from 'ignore';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { ConfirmationDialog } from '~/components/ui/Dialog';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { describeSetupCommands, parseGitDeepLink } from '~/lib/git/deep-link';
import { useGit } from '~/lib/hooks/useGit';
import { useChatHistory } from '~/lib/persistence';
import { createMessage } from '~/lib/persistence/messageMigration';
import { hostedModeStore } from '~/lib/stores/hosted';
import { isSafeImportPath } from '~/utils/fileUtils';
import { createCommandsMessage, detectProjectCommands, escapeBoltTags } from '~/utils/projectCommands';

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.github/**',
  '.vscode/**',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.png',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',

  // Include this so npm install runs much faster '**/*lock.json',
  '**/*lock.yaml',
];

type ClonedRepo = {
  url: string;
  filesMessage: UIMessage;
  commandsMessage: UIMessage | null;
  commands: string[];
};

type Step =
  | { kind: 'waiting' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'confirm-clone'; url: string; host: string }
  | { kind: 'cloning' }
  | { kind: 'confirm-run'; repo: ClonedRepo }
  | { kind: 'importing' };

/*
 * A /git?url= link can come from anyone, so nothing happens until the user
 * has seen the exact URL and host, and repo scripts (npm install runs
 * lifecycle scripts) need a second, separate yes.
 */
export function GitUrlImport() {
  const [searchParams] = useSearchParams();
  const { ready: historyReady, importChat } = useChatHistory();
  const { ready: gitReady, gitClone } = useGit();
  const hosted = useStore(hostedModeStore);
  const [step, setStep] = useState<Step>({ kind: 'waiting' });

  const goHome = () => {
    window.location.href = '/';
  };

  const fail = (error: unknown) => {
    console.error('Error during import:', error);
    toast.error('Failed to import repository');
    goHome();
  };

  useEffect(() => {
    if (step.kind !== 'waiting' || !historyReady || !gitReady) {
      return;
    }

    const link = parseGitDeepLink(searchParams.get('url'), hosted);
    setStep(
      link.ok ? { kind: 'confirm-clone', url: link.url, host: link.host } : { kind: 'invalid', reason: link.reason },
    );
  }, [searchParams, historyReady, gitReady, hosted, step.kind]);

  const finishImport = async (repo: ClonedRepo, runCommands: boolean) => {
    setStep({ kind: 'importing' });

    const messages: UIMessage[] = [repo.filesMessage];

    if (runCommands && repo.commandsMessage) {
      messages.push(
        createMessage({
          role: 'user',
          id: generateId(),
          text: 'Setup the codebase and Start the application',
        }) as UIMessage,
      );
      messages.push(repo.commandsMessage);
    }

    try {
      await importChat?.(`Git Project:${repo.url.split('/').slice(-1)[0]}`, messages, { gitUrl: repo.url });
    } catch (error) {
      fail(error);
    }
  };

  const cloneConfirmed = async (repoUrl: string) => {
    setStep({ kind: 'cloning' });

    const ig = ignore().add(IGNORE_PATTERNS);

    try {
      const { workdir, data } = await gitClone(repoUrl);
      const filePaths = Object.keys(data).filter((filePath) => isSafeImportPath(filePath) && !ig.ignores(filePath));
      const textDecoder = new TextDecoder('utf-8');

      const fileContents = filePaths
        .map((filePath) => {
          const { data: content, encoding } = data[filePath];
          return {
            path: filePath,
            content: encoding === 'utf8' ? content : content instanceof Uint8Array ? textDecoder.decode(content) : '',
          };
        })
        .filter((f) => f.content);

      const commands = await detectProjectCommands(fileContents);

      const filesMessage = createMessage({
        role: 'assistant',
        id: generateId(),
        text: `Cloning the repo ${escapeBoltTags(repoUrl)} into ${escapeBoltTags(workdir)}
<boltArtifact id="imported-files" title="Git Cloned Files"  type="bundled">
${fileContents
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>`,
      }) as UIMessage;

      const repo: ClonedRepo = {
        url: repoUrl,
        filesMessage,
        commandsMessage: createCommandsMessage(commands),
        commands: describeSetupCommands(commands),
      };

      if (repo.commandsMessage) {
        setStep({ kind: 'confirm-run', repo });
      } else {
        await finishImport(repo, false);
      }
    } catch (error) {
      fail(error);
    }
  };

  return (
    <ClientOnly fallback={<BaseChat />}>
      {() => (
        <>
          <Chat />
          {(step.kind === 'cloning' || step.kind === 'importing') && (
            <LoadingOverlay message="Please wait while we clone the repository..." />
          )}
          <ConfirmationDialog
            isOpen={step.kind === 'invalid'}
            onClose={goHome}
            onConfirm={goHome}
            title="Can't import this link"
            description={step.kind === 'invalid' ? step.reason : ''}
            confirmLabel="Go home"
            cancelLabel="Close"
          />
          <ConfirmationDialog
            isOpen={step.kind === 'confirm-clone'}
            onClose={goHome}
            onConfirm={() => step.kind === 'confirm-clone' && void cloneConfirmed(step.url)}
            title="Clone this repository?"
            description={
              step.kind === 'confirm-clone' ? (
                <span className="flex flex-col gap-2">
                  <span>A link asked Hypeable to clone a repository. Only continue if you expected this.</span>
                  <span>
                    Host: <strong data-testid="git-import-host">{step.host}</strong>
                  </span>
                  <code data-testid="git-import-url" className="break-all text-bolt-elements-textPrimary">
                    {step.url}
                  </code>
                  <span>Nothing from the repository runs yet.</span>
                </span>
              ) : (
                ''
              )
            }
            confirmLabel="Clone"
          />
          <ConfirmationDialog
            isOpen={step.kind === 'confirm-run'}
            onClose={() => step.kind === 'confirm-run' && void finishImport(step.repo, false)}
            onConfirm={() => step.kind === 'confirm-run' && void finishImport(step.repo, true)}
            title="Run this repository's code?"
            description={
              step.kind === 'confirm-run' ? (
                <span className="flex flex-col gap-2">
                  <span>
                    <strong>Warning:</strong> these commands install packages and run scripts written by the repository
                    author. Install scripts can run arbitrary code in this tab's sandbox, including reading the files
                    and making network requests. Run them only if you trust this repository.
                  </span>
                  <span className="break-all">{step.repo.url}</span>
                  {step.repo.commands.map((command) => (
                    <code key={command} data-testid="git-import-command" className="break-all">
                      {command}
                    </code>
                  ))}
                </span>
              ) : (
                ''
              )
            }
            confirmLabel="Run commands"
            cancelLabel="Import files only"
          />
        </>
      )}
    </ClientOnly>
  );
}
