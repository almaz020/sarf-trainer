// Случайная перестановка Фишера-Йетса; вход не мутируется.
export function shuffleLetters<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(random() * (i + 1)), i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
