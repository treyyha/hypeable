/**
 * Recent chats as cards. Empty state is designed and honest — no placeholders.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { EmptyState } from '~/components/ui/EmptyState';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';

export function RecentProjects() {
  const [items, setItems] = useState<ChatHistoryItem[] | null>(null);

  useEffect(() => {
    if (!db) {
      setItems([]);
      return;
    }

    getAll(db)
      .then((list) =>
        list
          .filter((item) => item.urlId && item.description)
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
          .slice(0, 6),
      )
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items === null) {
    return null;
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">
          Recent projects
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-4 pt-2">
        {items.length === 0 ? (
          <EmptyState
            icon="i-ph:folder-dashed"
            title="No projects yet"
            description="Your builds will land here. Describe an app above to start."
            variant="compact"
            className="flex-1 border-0 bg-transparent p-2 shadow-none"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <a
                key={item.id}
                href={`/chat/${item.urlId}`}
                className="block rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-surface-2 p-3 transition-colors hover:border-hype-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
              >
                <p className="truncate text-sm font-medium text-hype-text">{item.description}</p>
                <p className="mt-1 text-xs text-hype-muted">
                  {new Date(item.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
