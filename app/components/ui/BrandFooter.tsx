import { BUILD_COMMIT, BUILD_VERSION, githubCommitUrl, versionLine } from '~/lib/commit';
import { APP_AFFILIATION, APP_REPO_URL } from '~/utils/brand';
import { classNames } from '~/utils/classNames';

export function BrandFooter({ className }: { className?: string }) {
  const label = versionLine(BUILD_VERSION, BUILD_COMMIT);
  const href = githubCommitUrl(APP_REPO_URL, BUILD_COMMIT);

  return (
    <div
      className={classNames('px-4 py-2 text-center text-[11px] leading-4 text-bolt-elements-textTertiary', className)}
    >
      <p>
        {href ? (
          <a
            href={href}
            className="text-bolt-elements-textTertiary underline-offset-2 hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            {label}
          </a>
        ) : (
          <span>{label}</span>
        )}
      </p>
      <p className="mt-1">{APP_AFFILIATION}</p>
    </div>
  );
}
