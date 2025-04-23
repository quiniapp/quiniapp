import {
  //Maximize,
  //MinusIcon,
  //Sun,
  //Moon,
  UserIcon,
} from 'lucide-react';
import { FlexCol } from '@/components/flex';

const Header = ({ title }: { title: string }) => {
  return (
    <div className="bg-primary text-white h-[70px] flex justify-between items-center px-1">
      <h1 className="font-semibold">{title}</h1>
      <div className="flex gap-[16px]">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8  rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            <UserIcon size={20} className="text-gray-700" />
          </div>
          <FlexCol className={'pr-4'}>
            <div className="text-sm text-white font-semibold">Administrador</div>
            <div className="text-xs text-white">(usuario 1)</div>
          </FlexCol>
        </div>
      </div>
    </div>
  );
};

export default Header;
