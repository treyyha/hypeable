/**
 * Chat identity atoms, split out of useChatHistory so spend/ledger can
 * read them without pulling WebContainer into unit tests.
 */
import { atom } from 'nanostores';

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
