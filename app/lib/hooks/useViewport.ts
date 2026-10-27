import { useState, useEffect } from 'react';

export function readIsSmallViewport(threshold = 1024, win: { innerWidth: number } | undefined = globalThis.window) {
  if (!win) {
    return false;
  }

  return win.innerWidth < threshold;
}

const useViewport = (threshold = 1024) => {
  // SSR and the first client paint must match; window width is applied after mount.
  const [isSmallViewport, setIsSmallViewport] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsSmallViewport(readIsSmallViewport(threshold));
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [threshold]);

  return isSmallViewport;
};

export default useViewport;
