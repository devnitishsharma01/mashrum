export function toNumber(value: { toString(): string } | number | string): number {
  if (typeof value === "number") return value;
  return Number(value);
}
