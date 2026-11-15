/**
 * App-wide Toast (ui_design.md §3.2, §6): one short message at the bottom, gone after 4 s.
 * A context, so the card, forms and lists can confirm an action even when they close right after.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Toast } from "../components/ui";

const ToastContext = createContext<(message: string) => void>(() => undefined);

const TOAST_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);
  const show = useCallback((text: string) => setMessage({ text, key: Date.now() }), []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && <Toast key={message.key} message={message.text} />}
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
