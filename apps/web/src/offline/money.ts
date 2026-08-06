export function centsOf(money: string): bigint {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(money);
  if (!match) {
    throw new Error(`Invalid money value: ${money}`);
  }
  const sign = match[1] ?? "";
  const integer = match[2] ?? "0";
  const fraction = match[3] ?? "00";
  const absolute = BigInt(integer) * 100n + BigInt(fraction);
  return sign === "-" ? -absolute : absolute;
}

export function moneyOf(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  const integer = absolute / 100n;
  const fraction = absolute % 100n;
  return `${sign}${integer.toString()}.${fraction.toString().padStart(2, "0")}`;
}

export function sumMoney(values: string[]): string {
  return moneyOf(values.reduce((total, value) => total + centsOf(value), 0n));
}
