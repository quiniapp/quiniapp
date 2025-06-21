import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonListProps {
  row?: number;
  className?: string;
  height?: string;
}

const SkeletonList = ({ row = 8, className = '', height = 'h-[24px]' }: SkeletonListProps) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: row }).map((_, i) => (
        <Skeleton key={i} className={`rounded-md p-4 bg-blue-500/10 ${height} ${className}`} />
      ))}
    </div>
  );
};

export default SkeletonList;
