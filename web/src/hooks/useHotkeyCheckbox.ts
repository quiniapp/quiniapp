import { useEffect } from 'react';

type KeyRefPair = {
  key: string;
  ref: React.RefObject<HTMLInputElement>;
};

export function useHotkeyCheckbox(pairs: KeyRefPair[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const match = pairs.find((pair) => pair.key === e.key);
      if (match && match.ref.current) {
        e.preventDefault();
        match.ref.current.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pairs]);
}
