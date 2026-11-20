'use client';

import { middleCutParts } from '@/lib/domain/materiel-tabs';

/**
 * Un nom de matériel coupé au milieu quand la place manque, jamais à la fin
 * (audit du 19 novembre 2026, lot J, n° 15, F461) : la fin reste entière,
 * la coupure tombe dans le début ; le nom entier est dans la bulle, et le
 * texte de l'élément reste le nom entier.
 */
export function MiddleCut({ text }: { text: string }) {
  const { head, tail } = middleCutParts(text);
  return (
    <span className="middle-cut" title={text}>
      <span className="middle-cut-head">{head}</span>
      {tail ? <span className="middle-cut-tail">{tail}</span> : null}
    </span>
  );
}
