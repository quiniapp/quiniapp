import { useEffect, useState } from 'react';

type Platform = 'mobile' | 'desktop' | 'web';

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    const userAgent = navigator.userAgent;

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);

    const isElectron = Boolean(
      typeof window !== 'undefined' &&
        window.process &&
        typeof window.process === 'object' &&
        // @ts-expect-error: `type` does exist in Electron environments
        window.process.type === 'renderer'
    );

    if (isMobile) {
      setPlatform('mobile');
    } else if (isElectron) {
      setPlatform('desktop');
    } else {
      setPlatform('web');
    }
  }, []);

  return platform;
}
