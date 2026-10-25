/**
 * Recent chats as cards. Empty state is designed and honest — no placeholders.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent } from '~/components/ui/Card';
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
    <section className="w-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">
        Recent projects
      </h2>
      {items.length === 0 ? (
        <EmptyState
          icon="i-ph:folder-dashed"
          title="No projects yet"
          description="Your builds will land here. Describe an app above to start."
          variant="compact"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`/chat/${item.urlId}`}
              className="block rounded-[var(--hype-radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
            >
              <Card className="h-full transition-colors hover:border-hype-accent/40">
                <CardContent className="p-4">
                  <p className="truncate text-sm font-medium text-hype-text">{item.description}</p>
                  <p className="mt-1 text-xs text-hype-muted">
                    {new Date(item.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
