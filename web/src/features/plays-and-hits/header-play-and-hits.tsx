import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import dayjs from 'dayjs';
import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const HeaderPlayAndHits = () => {
  const today = dayjs();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date');

  // Inicializar fecha si no está en la URL — también re-ejecuta al volver a la página sin params
  useLayoutEffect(() => {
    if (!date) {
      const params = new URLSearchParams(searchParams);
      params.set('date', today.format('YYYY-MM-DD'));
      setSearchParams(params, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handleDayChange = (date?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('date', date ?? today.format('YYYY-MM-DD'));
    setSearchParams(params);
  };

  return (
    <HeaderSection title={'Jugadas'}>
      <SelectDayToSearch onDayChange={handleDayChange} toDate={today.toDate()} />
    </HeaderSection>
  );
};

export default HeaderPlayAndHits;
