import { useState, useEffect } from 'react';

const Footer = () => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-[var(--primary-bg-content)] text-white  py-4 border-t border-gray-700 flex justify-end px-8">
      <div className="text-right">
        <div className="text-4xl font-semibold text-primary">{formatTime(currentDateTime)}</div>
        <div className="text-sm text-gray-400">{formatDate(currentDateTime)}</div>
      </div>
    </div>
  );
};

export default Footer;
