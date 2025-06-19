import { useEffect, useRef, useState, Dispatch, SetStateAction, RefObject } from 'react';

type CheckboxState = {
  checked: boolean;
  setChecked: Dispatch<SetStateAction<boolean>>;
  ref: RefObject<HTMLButtonElement | null>;
};

type CheckboxStateMap = Record<string, CheckboxState>;

export const useKeyboardCheckboxes = (): CheckboxStateMap => {
  const [isF1Checked, setIsF1Checked] = useState(false);
  const [isF2Checked, setIsF2Checked] = useState(false);
  const [isF3Checked, setIsF3Checked] = useState(false);
  const [isF4Checked, setIsF4Checked] = useState(false);
  const [isF5Checked, setIsF5Checked] = useState(false);

  const refF1 = useRef<HTMLButtonElement>(null);
  const refF2 = useRef<HTMLButtonElement>(null);
  const refF3 = useRef<HTMLButtonElement>(null);
  const refF4 = useRef<HTMLButtonElement>(null);
  const refF5 = useRef<HTMLButtonElement>(null);

  const keyMap: Record<string, React.Dispatch<React.SetStateAction<boolean>>> = {
    F1: setIsF1Checked,
    F2: setIsF2Checked,
    F3: setIsF3Checked,
    F4: setIsF4Checked,
    F5: setIsF5Checked,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (keyMap[e.key]) {
        e.preventDefault();
        keyMap[e.key]((prev) => !prev);

        // Activar manualmente el click
        const refMap: Record<string, React.RefObject<HTMLButtonElement | null>> = {
          F1: refF1,
          F2: refF2,
          F3: refF3,
          F4: refF4,
          F5: refF5,
        };

        const ref = refMap[e.key];
        if (ref?.current) {
          ref.current.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    f1: { checked: isF1Checked, setChecked: setIsF1Checked, ref: refF1 },
    f2: { checked: isF2Checked, setChecked: setIsF2Checked, ref: refF2 },
    f3: { checked: isF3Checked, setChecked: setIsF3Checked, ref: refF3 },
    f4: { checked: isF4Checked, setChecked: setIsF4Checked, ref: refF4 },
    f5: { checked: isF5Checked, setChecked: setIsF5Checked, ref: refF5 },
  };
};
