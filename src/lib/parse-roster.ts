/**
 * Converte um texto colado (com números, pontuação, múltiplos por linha, typos)
 * em uma lista limpa de nomes normalizados com Capitalização Correta (Title Case)
 * e remoção de duplicatas.
 */
export function cleanPlayerName(raw: string): string {
  // Remove números no início, hífens, parênteses ou pontos (ex: "1. ", "02 - ", "3) ")
  let s = raw.replace(/^[\s\d.\-)]+/, "").trim();
  // Remove marcações extras comuns como "(goleiro)", "(gk)"
  s = s.replace(/\s*\((?:goleiro|gk|g)\)\s*/gi, "").trim();

  if (!s) return "";

  // Title case inteligente em português
  const words = s.split(/\s+/).filter(Boolean);
  const lowercaseWords = new Set(["de", "da", "do", "dos", "das", "e"]);

  const capitalized = words.map((w, index) => {
    const lower = w.toLowerCase();
    if (index > 0 && lowercaseWords.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return capitalized.join(" ");
}

/**
 * Faz o parse de listas de texto livre ou numeradas.
 * Exemplo:
 * "1. Nome Sobrenome
 *  2. Outro Atleta"
 */
export function parseNumberedRoster(text: string): string[] {
  if (!text) return [];

  // Tratamento especial para casos como "13. marcio14.  Godoy"
  // Insere quebra de linha antes de qualquer sequência de dígito seguido de ponto
  const spaced = text.replace(/([^\s\d])\s*(\d+[\.\-\)])/g, "$1\n$2");

  // Divide por quebra de linha ou vírgula
  const lines = spaced.split(/[\r\n,;]+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const cleaned = cleanPlayerName(line);
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  return result;
}
