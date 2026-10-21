const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const money = (value: string) => currency.format(Number(value));
export const price = (value: string) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(Number(value));
export const pnlClass = (value: string) =>
  Number(value) < 0 ? "negative" : Number(value) > 0 ? "positive" : "";
export const sessionDate = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
export const sessionTime = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
