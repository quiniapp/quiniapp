import { useTheme } from '@/providers/theme-provider';
import { Maximize, MinusIcon, Sun, Moon } from 'lucide-react';

const Header = ({ title }: { title: string }) => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="bg-red-500 text-white h-10 flex justify-between items-center px-4">
      <h1 className="font-semibold">{title}</h1>
      <div className="flex gap-[16px]">
        <button className="ml-2 hover:bg-red-600 p-1">
          <MinusIcon size={16} />
        </button>
        <button className="ml-2 hover:bg-red-600 p-1">
          <Maximize size={16} />
        </button>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          <div className="flex">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Header;
