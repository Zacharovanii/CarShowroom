/**
 * Деньги приходят строкой и строкой остаются (D12, инвариант контракта).
 * Number здесь не появляется намеренно: «4650000.00» через parseFloat и
 * обратно — это лишний повод потерять копейку на ровном месте.
 */

const NBSP = " ";

/** Разряды группируются справа налево: «4650000» → «4 650 000». */
function groupDigits(digits: string): string {
  let out = "";
  for (let i = digits.length; i > 0; i -= 3) {
    const chunk = digits.slice(Math.max(0, i - 3), i);
    out = out === "" ? chunk : `${chunk}${NBSP}${out}`;
  }
  return out;
}

/**
 * «4650000» → «4 650 000 ₽», «4650000.50» → «4 650 000,50 ₽».
 * Копейки показываем, только если они ненулевые: у нас все цены круглые,
 * и «,00» в каталоге — визуальный шум.
 */
export function formatMoney(value: string): string {
  const [whole = "0", fraction] = value.split(".");
  const amount =
    fraction && Number(fraction) !== 0
      ? `${groupDigits(whole)},${fraction.padEnd(2, "0")}`
      : groupDigits(whole);

  return `${amount}${NBSP}₽`;
}
