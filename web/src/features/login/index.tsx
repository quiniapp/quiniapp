import { Flex } from '@/components/flex';

const LoginContent = () => {
  return (
    <Flex className={'h-screen'}>
      <Flex className={'flex-1'}></Flex>
      <Flex className={'flex-1 justify-center items-center gap-4'}>
        <input type={'text'} placeholder={'Nombre'} />
      </Flex>
    </Flex>
  );
};

export default LoginContent;
