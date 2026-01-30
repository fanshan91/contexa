import type { GlossaryAiConstraints } from '@/lib/glossary/repo';

export function formatGlossaryConstraintsForAi(input: GlossaryAiConstraints) {
  const forced = input.terms.filter((t) => t.type === 'forced');
  const recommended = input.terms.filter((t) => t.type === 'recommended');
  const negatives = input.negativePrompts.filter((n) => n.phrase.trim().length > 0);

  const lines: string[] = [];
  lines.push(`Target locale: ${input.locale}`);

  if (forced.length > 0) {
    lines.push('Terminology (forced):');
    forced.forEach((t) => lines.push(`- ${t.source} -> ${t.target}`));
  }

  if (recommended.length > 0) {
    lines.push('Terminology (recommended):');
    recommended.forEach((t) => lines.push(`- ${t.source} -> ${t.target}`));
  }

  if (negatives.length > 0) {
    lines.push('Negative prompts (avoid):');
    negatives.forEach((n) =>
      lines.push(`- Avoid "${n.phrase}"${n.alternative ? `; use "${n.alternative}"` : ''}`)
    );
  }

  return lines.join('\n');
}

