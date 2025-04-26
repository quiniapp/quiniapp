import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils.ts';

interface BasicModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  className?: string;
  isCloseButton?: boolean
  children?: React.ReactNode;

}

const Modal  = ({ isOpen, title, description, onClose, children, className, isCloseButton=false }: BasicModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className={cn(className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="py-4 ">
          {children}
        </div>
        {isCloseButton &&(
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2   rounded" onClick={onClose}>
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
