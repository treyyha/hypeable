import logger from 'electron-log';
import type { MessageBoxOptions } from 'electron';
import { app, dialog } from 'electron';
import type { AppUpdater, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import path from 'node:path';

// NOTE: workaround to use electron-updater.
import * as electronUpdater from 'electron-updater';
import { isDev } from './constants';

const autoUpdater: AppUpdater = (electronUpdater as any).default.autoUpdater;

let skipUpdateChecks = false;

export async function setupAutoUpdater() {
  // Configure logger
  logger.transports.file.level = 'debug';
  autoUpdater.logger = logger;

  // Configure custom update config file
  const resourcePath = isDev
    ? path.join(process.cwd(), 'electron-update.yml')
    : path.join(app.getAppPath(), 'electron-update.yml');
  logger.info('Update config path:', resourcePath);
  autoUpdater.updateConfigPath = resourcePath;

  // Disable auto download - we want to ask user first
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.info('checking-for-update...');
  });

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    logger.info('Update available.', info);

    const dialogOpts: MessageBoxOptions = {
      type: 'info' as const,
      buttons: ['Update', 'Later'],
      title: 'Application Update',
      message: `Version ${info.version} is available.`,
      detail: 'A new version is available. Would you like to update now?',
    };

    const response = await dialog.showMessageBox(dialogOpts);

    if (response.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('Update not available.');
  });

  autoUpdater.on('error', (err) => {
    if (isMissingGitHubRelease(err)) {
      if (!skipUpdateChecks) {
        logger.info('No GitHub releases yet; skipping update checks until a release is published.');
      }

      skipUpdateChecks = true;
      return;
    }

    logger.error('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info('Download progress:', progressObj);
  });

  autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
    logger.info('Update downloaded:', formatUpdateDownloadedEvent(event));

    const dialogOpts: MessageBoxOptions = {
      type: 'info' as const,
      buttons: ['Restart', 'Later'],
      title: 'Application Update',
      message: 'Update Downloaded',
      detail: 'A new version has been downloaded. Restart the application to apply the updates.',
    };

    const response = await dialog.showMessageBox(dialogOpts);

    if (response.response === 0) {
      autoUpdater.quitAndInstall(false);
    }
  });

  const hasReleases = await checkForUpdatesQuietly();

  if (!hasReleases) {
    return;
  }

  setInterval(
    () => {
      void checkForUpdatesQuietly();
    },
    4 * 60 * 60 * 1000,
  );
}

function isMissingGitHubRelease(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${error.stack ?? ''}` : String(error);

  return /404|ENOTFOUND|not found|no published versions|latest\.yml|There are no published versions/i.test(message);
}

async function checkForUpdatesQuietly(): Promise<boolean> {
  if (skipUpdateChecks) {
    return false;
  }

  try {
    logger.info('Checking for updates. Current version:', app.getVersion());
    await autoUpdater.checkForUpdates();
    return !skipUpdateChecks;
  } catch (err) {
    if (isMissingGitHubRelease(err)) {
      skipUpdateChecks = true;
      logger.info('No GitHub releases yet; skipping update checks until a release is published.');
      return false;
    }

    logger.error('Failed to check for updates:', err);
    return true;
  }
}

function formatUpdateDownloadedEvent(event: UpdateDownloadedEvent): string {
  return JSON.stringify({
    version: event.version,
    downloadedFile: event.downloadedFile,
    files: event.files.map((e) => ({ files: { url: e.url, size: e.size } })),
  });
}
