import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

// const { toast, dismiss } = useToast();  toast({ title, description?, tone?, duration? })
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
