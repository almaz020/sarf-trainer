// Убирает знаки U+064B-U+0652 (огласовки, шадда, сукун); буквы и татвиль не трогает.
export function stripMarks(text: string): string {
  return text.replace(/[\u064b-\u0652]/g, '');
}
