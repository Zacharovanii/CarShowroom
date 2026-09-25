import { useCallback, useState, type ReactNode } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { Check, TriangleAlert } from "lucide-react";
import { ToastContext, type ToastOptions } from "./toastContext";
import styles from "./Toast.module.css";

interface ToastRecord extends ToastOptions {
  id: number;
}

const DEFAULT_DURATION = 6000;

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Провайдер уведомлений: очередь, живая область и автозакрытие — Radix Toast,
 * вид — свой. Сам показ вызывается хуком `useToast()`.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const showToast = useCallback((options: ToastOptions) => {
    setToasts((current) => [...current, { ...options, id: Date.now() + current.length }]);
  }, []);

  const close = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      <RadixToast.Provider duration={DEFAULT_DURATION} swipeDirection="right">
        {children}

        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            duration={toast.duration ?? DEFAULT_DURATION}
            onOpenChange={(open) => {
              if (!open) close(toast.id);
            }}
            data-tone={toast.tone ?? "success"}
            className={styles.toast}
          >
            <span className={styles.mark}>
              {toast.tone === "error" ? (
                <TriangleAlert aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
            </span>

            <div className={styles.text}>
              {toast.title && (
                <RadixToast.Title className={styles.title}>{toast.title}</RadixToast.Title>
              )}
              <RadixToast.Description className={styles.description}>
                {toast.description}
              </RadixToast.Description>
            </div>

            {toast.action && (
              <RadixToast.Action
                asChild
                altText={toast.action.label}
                className={styles.action}
                onClick={toast.action.onClick}
              >
                <button type="button">{toast.action.label}</button>
              </RadixToast.Action>
            )}
          </RadixToast.Root>
        ))}

        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
