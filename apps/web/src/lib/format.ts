export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function stockColor(
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK",
): string {
  if (status === "OUT_OF_STOCK") return "error";
  if (status === "LOW_STOCK") return "warning";
  return "success";
}
