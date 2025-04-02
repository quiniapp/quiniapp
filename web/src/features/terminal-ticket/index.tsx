import Layout from '@/components/layout';

interface TerminalTicketProps {
  item?: string;
}
export const TerminalTicketContent = ({ item }: TerminalTicketProps) => {
  return <Layout classname="flex">TerminalTicket {item}--- </Layout>;
};
