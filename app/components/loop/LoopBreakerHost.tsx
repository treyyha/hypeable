import { useStore } from '@nanostores/react';
import { LoopBreakerPanel } from './LoopBreakerPanel';
import { buildReplanPrompt, pickStrongerModel, type PickerModel } from '~/lib/loop';
import { dismissLoop, loopSettingsStore, loopStore, openModelPicker, rewindToMessage } from '~/lib/stores/loop';

export function LoopBreakerHost({
  sendMessage,
  currentModel,
  currentProvider,
  models,
  apiKeys,
}: {
  sendMessage: (text: string) => void;
  currentModel?: string;
  currentProvider?: string;
  models: readonly PickerModel[];
  apiKeys: Record<string, string>;
}) {
  const loop = useStore(loopStore);
  const settings = useStore(loopSettingsStore);

  if (!loop.isLooping || !settings.enabled) {
    return null;
  }

  const handleReplan = () => {
    sendMessage(
      buildReplanPrompt({
        error: loop.displayError,
        count: loop.count,
        tried: loop.tried,
      }),
    );
    dismissLoop();
  };

  const handleRevert = () => {
    if (loop.revertToMessageId) {
      rewindToMessage(loop.revertToMessageId);
    }

    dismissLoop();
  };

  const handleSwitchModel = () => {
    const picked = pickStrongerModel({
      currentModel: currentModel ?? '',
      currentProvider: currentProvider ?? '',
      models,
      apiKeys,
    });
    openModelPicker(picked ? { model: picked.name, provider: picked.provider } : undefined);
    dismissLoop();
  };

  return (
    <LoopBreakerPanel
      displayError={loop.displayError}
      count={loop.count}
      wastedCost={loop.wastedCost}
      canRevert={Boolean(loop.revertToMessageId)}
      onReplan={handleReplan}
      onRevert={handleRevert}
      onSwitchModel={handleSwitchModel}
      onKeepGoing={dismissLoop}
    />
  );
}
