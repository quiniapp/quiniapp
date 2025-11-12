import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useId } from 'react';

interface BasicModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  className?: string;
  isCloseButton?: boolean;
  children?: React.ReactNode;
}

const Modal = ({
  isOpen,
  title,
  description,
  onClose,
  children,
  className,
  isCloseButton = false,
}: BasicModalProps) => {
  const descId = useId();
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className={cn(className)} aria-describedby={description ? descId : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription id={descId}>{description}</DialogDescription>}
        </DialogHeader>

        <div className="py-4">{children}</div>

        {isCloseButton && (
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded" onClick={onClose}>
                Cerrar
              </button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
