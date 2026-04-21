import { memo } from 'react';
import { useClock } from '@/providers/ClockProvider';

const Footer = memo(function Footer() {
  const { time, date } = useClock();

  return (
    <div className="flex justify-end bg-[var(--primary-bg-content)] text-white 1440:py-4 py-1 border-t border-gray-700 px-4 sm:px-8">
      <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-0 text-right">
        <div className="text-xl sm:text-2xl 1440:text-4xl font-semibold text-primary">{time}</div>
        <div className="text-xs sm:text-sm text-gray-400">{date}</div>
      </div>
    </div>
  );
});

export default Footer;
