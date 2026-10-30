import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

const PREVIEW_CHANNEL = 'preview-updates';

/*
 * The id becomes the subdomain of the framed URL. Route params are
 * percent-decoded, so `evil.example%2Fx%3F` would frame any site under a
 * hypeable.dev address. WebContainer ids are one DNS label.
 */
const PREVIEW_ID = /^[a-z0-9-]{1,63}$/i;

export async function loader({ params }: LoaderFunctionArgs) {
  const previewId = params.id;

  if (!previewId) {
    throw new Response('Preview ID is required', { status: 400 });
  }

  if (!PREVIEW_ID.test(previewId)) {
    throw new Response(null, { status: 404 });
  }

  return Response.json({ previewId });
}

export default function WebContainerPreview() {
  const { previewId } = useLoaderData<typeof loader>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel>(undefined);
  const [previewUrl, setPreviewUrl] = useState('');

  // Handle preview refresh
  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      // Force a clean reload
      iframeRef.current.src = '';
      requestAnimationFrame(() => {
        if (iframeRef.current) {
          iframeRef.current.src = previewUrl;
        }
      });
    }
  }, [previewUrl]);

  // Notify other tabs that this preview is ready
  const notifyPreviewReady = useCallback(() => {
    if (broadcastChannelRef.current && previewUrl) {
      broadcastChannelRef.current.postMessage({
        type: 'preview-ready',
        previewId,
        url: previewUrl,
        timestamp: Date.now(),
      });
    }
  }, [previewId, previewUrl]);

  useEffect(() => {
    const supportsBroadcastChannel = typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';

    if (supportsBroadcastChannel) {
      broadcastChannelRef.current = new window.BroadcastChannel(PREVIEW_CHANNEL);

      // Listen for preview updates
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.previewId === previewId) {
          if (event.data.type === 'refresh-preview' || event.data.type === 'file-change') {
            handleRefresh();
          }
        }
      };
    } else {
      broadcastChannelRef.current = undefined;
    }

    // Construct the WebContainer preview URL
    const url = `https://${previewId}.local-credentialless.webcontainer-api.io`;
    setPreviewUrl(url);

    // Set the iframe src
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    // Notify other tabs that this preview is ready
    notifyPreviewReady();

    // Cleanup
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [previewId, handleRefresh, notifyPreviewReady]);

  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        title="WebContainer Preview"
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
        allow="cross-origin-isolated"
        loading="eager"
        onLoad={notifyPreviewReady}
      />
    </div>
  );
}
