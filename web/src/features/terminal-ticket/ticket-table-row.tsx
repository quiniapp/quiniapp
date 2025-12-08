import { TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { forwardRef, memo } from 'react';

interface TicketTableHeaderProps {
  className?: string;
}

export const TicketTableHeader = ({ className }: TicketTableHeaderProps) => {
  return (
    <TableRow className={cn("bg-card-bg sticky top-0 z-10", className)}>
      <TableHead className="bg-card-bg text-white min-w-40 w-[40%]">Número</TableHead>
      <TableHead className="bg-card-bg text-white w-[30%] ">Pasador</TableHead>
      <TableHead className="bg-card-bg text-white w-[15%] ">Monto</TableHead>
      <TableHead className="bg-card-bg text-white  w-[15%] ">Pagado</TableHead>
    </TableRow>
  );
};

interface TicketTableRowProps {
  ticket: ITicketEntityFront;
  isSelected: boolean;
  onClick: (ticket_number: string) => void;
}

export const TicketTableRow = memo(
  forwardRef<HTMLTableRowElement, TicketTableRowProps>(
    ({ ticket, isSelected, onClick }, ref) => {
      return (
        <TableRow
          ref={ref}
          key={String(ticket.ticket_id)}
          data-state={isSelected ? 'selected' : undefined}
          className={cn(
            'w-full cursor-pointer hover:bg-primary-light transition',
            isSelected && 'bg-primary-light'
          )}
          onClick={() => onClick(ticket.ticket_number)}
        >
          <TableCell className="min-w-40 w-[40%]">{ticket.ticket_number}</TableCell>
          <TableCell className="w-[30%] ">{ticket.user_name}</TableCell>
          <TableCell className="w-[15%] ">${ticket.total}</TableCell>
          <TableCell className=" w-[15%] ">
            {ticket.paid ? 'Si' : 'No'}
          </TableCell>
        </TableRow>
      );
    }
  ),
  (prev, next) => {
    // Solo re-render si cambia el ticket_id o isSelected
    return (
      prev.ticket.ticket_id === next.ticket.ticket_id &&
      prev.isSelected === next.isSelected
    );
  }
);

TicketTableRow.displayName = 'TicketTableRow';
