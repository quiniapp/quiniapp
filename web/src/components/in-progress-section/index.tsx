import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
 


interface InProgressSectionProps {
  icon?: React.ReactNode;
  iconSize?: number | string;
  iconColor?: string;
  title?: string;
  text?: string;
  onClick?: () => void;
}

const InProgressSection = ({
  icon,
  iconSize = 48,
  iconColor = 'currentColor',
  title,
  text,
  onClick,
}: InProgressSectionProps) => {
  return (
    <Flex className="justify-center items-start w-full py-[48px]">
      <FlexCol className="items-center gap-[24px]    ">
        <Flex>
          {icon ? (
            <div
              style={{
                width: iconSize,
                height: iconSize,
                color: iconColor,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {icon}
            </div>
          ) : (
            <img src={'/sad.svg'} width={240} height={240} alt={title} />
          )}
        </Flex>
        <FlexCol className="justify-center items-center gap-[16px] text-center">
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-sm leading-none font-light text-muted-foreground">{text}</p>
        </FlexCol>
        {onClick && <Button onClick={onClick}>Volver</Button>}
      </FlexCol>
    </Flex>
  );
};

export default InProgressSection;
