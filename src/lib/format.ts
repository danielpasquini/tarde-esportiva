const TZ = "America/Sao_Paulo";

export function formatMatchDate(date: Date) {
  const d = new Date(date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(d);
  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

  return `${datePart} às ${timePart} (${weekday})`;
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Converte o valor de <input type="datetime-local"> (horário de Brasília). */
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
