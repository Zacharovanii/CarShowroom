import { createContext, type ReactNode } from "react";

export type ToastTone = "success" | "error";

export interface ToastOptions {
  tone?: ToastTone;
  title?: string;
  description: ReactNode;
  /** Ссылка или кнопка справа: «Мои записи», «Повторить». */
  action?: { label: string; onClick: () => void };
  /** Миллисекунды до автозакрытия. */
  duration?: number;
}

export type ShowToast = (options: ToastOptions) => void;

/**
 * Контекст лежит отдельно от провайдера: так файл с компонентом экспортирует
 * только компоненты и Fast Refresh не спотыкается (тот же приём, что в
 * features/auth).
 */
export const ToastContext = createContext<ShowToast | null>(null);
