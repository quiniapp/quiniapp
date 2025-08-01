
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "../../../../routes/routes";


const fetchScheduleLottery = async () => {
  const url = ROUTES.schedule_lottery.base;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching results');
  const { data } = await res.json();

  return data;
};

export const useScheduleLottery = () => {

  return useQuery({
    queryKey: ['schedule-lottery'],
    queryFn: () => fetchScheduleLottery(), 
  });
};
