import { useEffect, useState } from "react";

/** Пауза, после которой набранное уходит в URL и в запрос. */
const DEBOUNCE_MS = 350;

/**
 * Поле, которое отдаёт значение не на каждую букву. Набранное живёт локально,
 * а в URL уезжает после паузы — иначе поиск дёргал бы API на каждый символ
 * и засорял историю.
 *
 * `value` — то, что сейчас в URL: оно меняется извне при «назад» и при сбросе
 * фильтров. Черновик подменяется им прямо во время отрисовки, а не эффектом:
 * так React не делает лишний проход (react.dev, «You Might Not Need an Effect»).
 */
export function useDebouncedField(value: string, commit: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const [seenValue, setSeenValue] = useState(value);

  if (value !== seenValue) {
    setSeenValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commit(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, commit]);

  return [draft, setDraft] as const;
}
