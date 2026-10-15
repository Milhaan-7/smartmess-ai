import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, danger }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm text-gray-600">{children}</div>
    </Modal>
  );
}
