import { Skeleton } from '@/components/ui/skeleton';

const SkeletonList = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className="  space-x-4 p-6 rounded-md h-[24px]"
          style={{ backgroundColor: 'rgb(59 130 246 / 0.1)' }}
        />
      ))}
    </div>
  );
};

export default SkeletonList;
