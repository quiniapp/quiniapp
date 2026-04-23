import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';

const MinAmountInput = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const grouped = searchParams.get('grouped') === 'true';
  const [value, setValue] = useState(searchParams.get('min_amount') ?? '');

  if (!grouped) return null;

  const apply = () => {
    const params = new URLSearchParams(searchParams);
    const num = parseFloat(value);
    if (!num || num <= 0) params.delete('min_amount');
    else params.set('min_amount', String(num));
    setSearchParams(params);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Monto mínimo</span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        placeholder="0"
        className="w-[120px] h-8"
      />
    </div>
  );
};

export default MinAmountInput;
