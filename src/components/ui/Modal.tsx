import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onOpenChange, title, description, children, size = 'md' }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; size?: 'md' | 'lg';
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="modal-overlay" />
      <Dialog.Content className={`modal-content modal-${size}`}>
        <div className="modal-heading">
          <div><Dialog.Title className="modal-title">{title}</Dialog.Title>{description && <Dialog.Description className="modal-description">{description}</Dialog.Description>}</div>
          <Dialog.Close asChild><button className="icon-button modal-close" aria-label="Close dialog"><X size={18} /></button></Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
