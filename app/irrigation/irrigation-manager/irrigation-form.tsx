'use client';
import { hydraulicMessage } from '@/lib/domain/hydraulic-message';
import { evaluateHydraulicFeasibility } from '@/lib/domain/pumps';

/**
 * La faisabilité hydraulique en phrase d'action (audit ergonomique, lot 3,
 * point 6, cas 4) : ce qui ne va pas et quoi faire, le détail chiffré dessous.
 * Rien n'est montré tant qu'aucun matériel n'est choisi (cas 3) : pas de cadre
 * rouge avant un choix de l'utilisateur. Le moteur ne calcule aucune
 * solution : il n'y a donc pas de bouton pour en appliquer une (F46).
 */
export function HydraulicIndicator({
  feasibility,
  historical,
}: {
  feasibility: ReturnType<typeof evaluateHydraulicFeasibility>;
  historical: boolean;
}) {
  const message = hydraulicMessage(feasibility, historical);
  const tone = message.tone === 'exceeded' ? 'is-exceeded' : message.tone === 'ok' ? 'is-ok' : 'is-unknown';
  return <div className={`hydraulic-indicator ${tone}`} role={message.tone === 'exceeded' ? 'status' : undefined}>
    <strong>{message.sentence}</strong>
    {message.detail ? <small>{message.detail}</small> : null}
  </div>;
}

export function ActionTab({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} data-active={active} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}
