const Logo = () => {
  return (
    <div>
      <img
        src={'/logo-example.png'}
        alt={'QuiniApp Logo'}
        className={'w-[100px] lg:w-[140px] xl:w-[200px]'}
        width={200}
        height={200}
        fetchpriority="high"
        decoding="sync"
      />
    </div>
  );
};

export default Logo;
