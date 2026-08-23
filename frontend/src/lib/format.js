export function formatMoney(amount, currency = "INR") {
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

export function stockColor(status) {
  if (status === "OUT_OF_STOCK") return "error";
  if (status === "LOW_STOCK") return "warning";
  return "success";
}
