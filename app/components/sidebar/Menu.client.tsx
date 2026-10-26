import { useStore } from '@nanostores/react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { HistoryItem } from './HistoryItem';
import { binDates, groupHistoryBins } from './date-binning';

/*
 * Lazy-load the heavy ControlPanel (settings UI).  Most users don't open it on
 * every visit, so keeping it out of the critical-path bundle improves initial
 * load time.
 */
const LazyControlPanel = lazy(() =>
  import('~/components/@settings/core/ControlPanel').then((m) => ({ default: m.ControlPanel })),
);
import { Button } from '~/components/ui/Button';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { DocumentationPanel } from '~/components/ui/DocumentationPanel';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import {
  setSidebarCollapsed,
  setSidebarMobileOpen,
  sidebarCollapsedStore,
  sidebarMobileOpenStore,
} from '~/lib/stores/sidebar';
import { APP_REPO_URL } from '~/utils/brand';
import { classNames } from '~/utils/classNames';

type DialogContent =
  { type: 'delete'; item: ChatHistoryItem } | { type: 'bulkDelete'; items: ChatHistoryItem[] } | null;

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory({ loadHistory: false });
  const menuRef = useRef<HTMLElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const collapsed = useStore(sidebarCollapsedStore);
  const mobileOpen = useStore(sidebarMobileOpenStore);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocumentationOpen, setIsDocumentationOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        console.log('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete the chat from the database
      await deleteById(db, id);
      console.log('Successfully deleted chat:', id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      deleteChat(item.id)
        .then(() => {
          toast.success('Chat deleted successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Always refresh the list
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            console.log('Navigating away from deleted chat');
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          toast.error('Failed to delete conversation', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Still try to reload entries in case data has changed
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: No DB or no items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      let deletedCount = 0;

      const errors: string[] = [];
      const currentChatId = chatId.get();

      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, db],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);

    if (selectionMode) {
      // If turning selection mode OFF, clear selection
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const handleOpenGitHubSettings = () => {
      setSettingsInitialTab('github');
      setIsSettingsOpen(true);
      setSidebarMobileOpen(false);
    };

    document.addEventListener('open-github-settings', handleOpenGitHubSettings);

    const handleOpenHypeableSettings = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      setSettingsInitialTab(tab);
      setIsSettingsOpen(true);
      setSidebarMobileOpen(false);
    };

    document.addEventListener('open-hypeable-settings', handleOpenHypeableSettings);

    return () => {
      document.removeEventListener('open-github-settings', handleOpenGitHubSettings);
      document.removeEventListener('open-hypeable-settings', handleOpenHypeableSettings);
    };
  }, []);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setSidebarMobileOpen(false);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
    setSettingsInitialTab(undefined);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  const showLabels = !collapsed;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-sidebar bg-hype-bg/70 lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarMobileOpen(false)}
        />
      ) : null}
      <aside
        ref={menuRef}
        className={classNames(
          'flex h-full shrink-0 flex-col border-r border-hype-border bg-hype-surface text-sm text-hype-text',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-max max-lg:w-[var(--hype-sidebar-width)]',
          'max-lg:transition-transform max-lg:duration-[var(--hype-duration-med)]',
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          collapsed ? 'lg:w-[var(--hype-sidebar-width-collapsed)]' : 'lg:w-[var(--hype-sidebar-width)]',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="flex h-[var(--header-height)] items-center gap-2 border-b border-hype-border px-3">
          <a href="/" className="flex min-w-0 items-center gap-2 text-hype-text">
            <img src="/favicon.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            {showLabels ? (
              <span className="truncate text-base font-semibold lowercase tracking-tight">hypeable</span>
            ) : null}
          </a>
          <button
            type="button"
            className="hype-icon-btn ml-auto hidden lg:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed(!collapsed)}
          >
            <span className={collapsed ? 'i-ph:caret-right' : 'i-ph:caret-left'} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="space-y-2 p-3">
            <div className="flex gap-2">
              <a
                href="/"
                title="New build"
                className={classNames(
                  'flex flex-1 items-center justify-center gap-2 rounded-[var(--hype-radius-md)] bg-hype-accent px-3 py-2 text-sm font-medium text-hype-on-accent hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring',
                  !showLabels && 'px-0',
                )}
              >
                <span className="i-ph:plus-circle h-4 w-4" />
                {showLabels ? <span>New build</span> : <span className="sr-only">New build</span>}
              </a>
              {showLabels ? (
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  className={classNames(
                    'hype-icon-btn',
                    selectionMode && 'border-hype-accent bg-hype-accent text-hype-on-accent hover:text-hype-on-accent',
                  )}
                  aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
                >
                  <span className={selectionMode ? 'i-ph:x h-4 w-4' : 'i-ph:check-square h-4 w-4'} />
                </button>
              ) : null}
            </div>
            {showLabels ? (
              <div className="relative w-full">
                <span className="pointer-events-none absolute left-3 top-1/2 i-ph:magnifying-glass h-4 w-4 -translate-y-1/2 text-hype-muted" />
                <input
                  className="w-full rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-bg py-2 pl-9 pr-3 text-sm text-hype-text placeholder:text-hype-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
                  type="search"
                  placeholder="Search"
                  onChange={handleSearchChange}
                  aria-label="Search chats"
                />
              </div>
            ) : null}
          </div>
          {showLabels && selectionMode ? (
            <div className="flex items-center justify-end gap-2 px-3 pb-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedItems.length === filteredList.length ? 'Deselect all' : 'Select all'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteClick}
                disabled={selectedItems.length === 0}
              >
                Delete selected
              </Button>
            </div>
          ) : null}
          <div className="flex-1 overflow-auto modern-scrollbar px-2 pb-3">
            {filteredList.length === 0 && showLabels && (
              <div className="px-3 py-6 text-sm text-hype-muted">
                {list.length === 0 ? 'No projects yet' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {groupHistoryBins(binDates(filteredList)).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  {showLabels ? (
                    <div className="sticky top-0 z-1 bg-hype-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">
                      {category}
                    </div>
                  ) : null}
                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDialogContentWithLogging({ type: 'delete', item });
                        }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-bolt-elements-background-depth-1">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-bolt-elements-textPrimary">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-2">Are you sure you want to delete this chat?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          console.log('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-bolt-elements-background-depth-1">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Selected Chats?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete {dialogContent.items.length}{' '}
                          {dialogContent.items.length === 1 ? 'chat' : 'chats'}:
                        </p>
                        <div className="mt-2 max-h-32 overflow-auto border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2 p-2">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-bolt-elements-textPrimary">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">Are you sure you want to delete these chats?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          console.log('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <nav className="mt-auto space-y-0.5 border-t border-hype-border p-2">
            <button
              type="button"
              onClick={handleSettingsClick}
              className="flex w-full items-center gap-2 rounded-[var(--hype-radius-sm)] bg-transparent px-2 py-2 text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
            >
              <span className="i-ph:gear h-4 w-4 shrink-0" />
              {showLabels ? <span>Settings</span> : <span className="sr-only">Settings</span>}
            </button>
            <button
              type="button"
              onClick={() => setIsDocumentationOpen(true)}
              className="flex w-full items-center gap-2 rounded-[var(--hype-radius-sm)] bg-transparent px-2 py-2 text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
            >
              <span className="i-ph:book-open h-4 w-4 shrink-0" />
              {showLabels ? <span>Docs</span> : <span className="sr-only">Docs</span>}
            </button>
            <a
              href={APP_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2 rounded-[var(--hype-radius-sm)] px-2 py-2 text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
            >
              <span className="i-ph:github-logo h-4 w-4 shrink-0" />
              {showLabels ? <span>GitHub</span> : <span className="sr-only">GitHub</span>}
            </a>
          </nav>
        </div>
      </aside>

      <Suspense fallback={null}>
        <LazyControlPanel open={isSettingsOpen} onClose={handleSettingsClose} initialTab={settingsInitialTab as any} />
      </Suspense>
      <DocumentationPanel open={isDocumentationOpen} onClose={() => setIsDocumentationOpen(false)} />
    </>
  );
};
