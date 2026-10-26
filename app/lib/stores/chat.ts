import { map } from 'nanostores';

export type MobilePane = 'chat' | 'preview' | 'code';

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
  mobilePane: 'chat' as MobilePane,
});
