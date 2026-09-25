import { useContext } from "react";
import { ToastContext, type ShowToast } from "./toastContext";

/** Одна строка в фиче: `const toast = useToast(); toast({ description: "…" })`. */
export function useToast(): ShowToast {
  const showToast = useContext(ToastContext);

  if (!showToast) {
    throw new Error("useToast используется вне <ToastProvider>");
  }

  return showToast;
}
