interface TerminalTicketProps {
  item?: string;
}
export const TerminalTicketContent = ({ item }: TerminalTicketProps) => {
  return <p> TerminalTicket {item}--- </p>;
};
