import React, { useState, useEffect, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import {
  getForgetKeysOnTabClose,
  readStoredApiKeys,
  setForgetKeysOnTabClose,
  writeStoredApiKeys,
} from '~/lib/api/api-key-storage';
import type { ProviderInfo } from '~/types/model';

interface APIKeyManagerProps {
  provider: ProviderInfo;
  apiKey: string;
  setApiKey: (key: string) => void;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
}

const providerEnvKeyStatusCache: Record<string, boolean> = {};

export function getApiKeysFromCookies() {
  return readStoredApiKeys();
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ provider, apiKey, setApiKey }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [isEnvKeySet, setIsEnvKeySet] = useState(false);
  const [forgetOnClose, setForgetOnClose] = useState(false);

  useEffect(() => {
    const savedKeys = readStoredApiKeys();
    const savedKey = savedKeys[provider.name] || '';

    setTempKey(savedKey);
    setIsEditing(false);
    setForgetOnClose(getForgetKeysOnTabClose());

    /*
     * Parent often passes an inline setApiKey. Including it in deps re-ran this
     * effect every render, which retriggered /api/models until fetch failed.
     */
    if (savedKey !== apiKey) {
      setApiKey(savedKey);
    }
  }, [provider.name]);

  const checkEnvApiKey = useCallback(async () => {
    if (providerEnvKeyStatusCache[provider.name] !== undefined) {
      setIsEnvKeySet(providerEnvKeyStatusCache[provider.name]);
      return;
    }

    try {
      const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(provider.name)}`);
      const data = await response.json();
      const isSet = (data as { isSet: boolean }).isSet;

      providerEnvKeyStatusCache[provider.name] = isSet;
      setIsEnvKeySet(isSet);
    } catch (error) {
      console.error('Failed to check environment API key:', error);
      setIsEnvKeySet(false);
    }
  }, [provider.name]);

  useEffect(() => {
    checkEnvApiKey();
  }, [checkEnvApiKey]);

  const handleSave = () => {
    setApiKey(tempKey);

    const currentKeys = readStoredApiKeys();
    writeStoredApiKeys({ ...currentKeys, [provider.name]: tempKey }, provider.name);

    setIsEditing(false);
  };

  const handleForgetToggle = (checked: boolean) => {
    setForgetKeysOnTabClose(checked);
    setForgetOnClose(checked);
  };

  return (
    <div className="py-3 px-1 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-bolt-elements-textSecondary">{provider?.name} API Key:</span>
            {!isEditing && (
              <div className="flex items-center gap-2">
                {apiKey ? (
                  <>
                    <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                    <span className="text-xs text-green-500">Set via UI</span>
                  </>
                ) : isEnvKeySet ? (
                  <>
                    <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                    <span className="text-xs text-green-500">Set via environment variable</span>
                  </>
                ) : (
                  <>
                    <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                    <span className="text-xs text-red-500">Not Set (Please set via UI or ENV_VAR)</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={tempKey}
                placeholder="Enter API Key"
                onChange={(e) => setTempKey(e.target.value)}
                className="w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor 
                        bg-bolt-elements-prompt-background text-bolt-elements-textPrimary 
                        focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
              />
              <IconButton
                onClick={handleSave}
                title="Save API Key"
                className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
              >
                <div className="i-ph:check w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => setIsEditing(false)}
                title="Cancel"
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
              >
                <div className="i-ph:x w-4 h-4" />
              </IconButton>
            </div>
          ) : (
            <>
              <IconButton
                onClick={() => setIsEditing(true)}
                title="Edit API Key"
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
              >
                <div className="i-ph:pencil-simple w-4 h-4" />
              </IconButton>
              {provider?.getApiKeyLink && !apiKey && (
                <IconButton
                  onClick={() => window.open(provider?.getApiKeyLink)}
                  title="Get API Key"
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 flex items-center gap-2"
                >
                  <span className="text-xs whitespace-nowrap">{provider?.labelForGetApiKey || 'Get API Key'}</span>
                  <div className={`${provider?.icon || 'i-ph:key'} w-4 h-4`} />
                </IconButton>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-bolt-elements-textSecondary max-w-3xl">
        Stored in your browser. Sent over HTTPS to this app's server for each request, used once for that request to
        your provider, never stored or logged. Verify it in{' '}
        <a href="https://github.com/treyyha/hypeable/blob/main/app/routes/api.chat.ts" className="underline">
          app/routes/api.chat.ts
        </a>
        . Want zero trust? Run Hypeable locally: pnpm dev.
      </p>
      <label className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary cursor-pointer">
        <input type="checkbox" checked={forgetOnClose} onChange={(event) => handleForgetToggle(event.target.checked)} />
        Forget keys when I close the tab
      </label>
    </div>
  );
};
