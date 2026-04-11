export function LayoutSkeleton() {
  const skeletonTime = new Date().toLocaleTimeString('es-AR', { hour12: false });

  return (
    <div
      style={{ backgroundColor: '#151933' }}
      className="flex h-dvh w-full overflow-hidden"
    >
      {/* Sidebar strip */}
      <div className="hidden md:flex w-[240px] flex-shrink-0 flex-col bg-sidebar border-r border-white/5 p-3 gap-3">
        <div className="h-8 w-32 rounded bg-white/10 animate-pulse" />
        <div className="flex flex-col gap-2 mt-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-7 rounded bg-white/10 animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="h-[50px] flex-shrink-0 bg-primary/90 flex items-center px-4 gap-3">
          <div className="h-5 w-5 rounded bg-white/20 animate-pulse md:hidden" />
          <div className="h-5 w-24 rounded bg-white/20 animate-pulse" />
          <div className="ml-auto h-7 w-7 rounded-full bg-white/20 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-4 flex flex-col gap-3">
          <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
          <div className="h-10 w-full rounded bg-white/10 animate-pulse" />
          <div className="h-10 w-full rounded bg-white/10 animate-pulse" />
          <div className="h-10 w-full rounded bg-white/10 animate-pulse" />
          <div className="h-10 w-3/4 rounded bg-white/10 animate-pulse" />
        </div>

        {/* Footer — mirrors real footer to register LCP early (text-4xl clock) */}
        <div className="flex justify-end py-1 border-t border-gray-700 px-8">
          <div className="text-right">
            <div className="text-4xl font-semibold text-primary opacity-30">{skeletonTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
