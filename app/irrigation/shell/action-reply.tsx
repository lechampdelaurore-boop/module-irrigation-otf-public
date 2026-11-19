'use client';

import { useEffect, useRef } from 'react';

/**
 * La réponse du module à un geste (audit du 19 novembre 2026, lot G, n° 1,
 * F404) : chaque message porte l'endroit du geste qui l'a fait naître, et ne
 * s'affiche que là, juste sous le bouton appuyé. À chaque nouveau message,
 * l'écran l'amène en vue au plus près, sans sauter en haut de la page.
 */
export type ActionReplyTone = 'notice' | 'warning' | 'error';

export type ActionReplyMessage = {
  /** L'endroit du geste : « formulaire », « objectif », « pluie », l'identifiant d'une planche… */
  origin: string;
  tone: ActionReplyTone;
  text: string;
  /** Change à chaque message, même identique au précédent : l'écran y revient. */
  serial: number;
};

let nextSerial = 1;

/** Un message nouveau, pour un endroit donné. */
export function actionReply(origin: string, tone: ActionReplyTone, text: string): ActionReplyMessage {
  nextSerial += 1;
  return { origin, tone, text, serial: nextSerial };
}

export function ActionReply({ messages, origin, classNames }: {
  messages: readonly (ActionReplyMessage | null)[];
  origin: string;
  /** Les classes du module pour chaque ton, pour garder le dessin de chaque section. */
  classNames: Record<ActionReplyTone, string>;
}) {
  const shown = messages.filter((message): message is ActionReplyMessage => message !== null && message.origin === origin);
  const zone = useRef<HTMLDivElement>(null);
  const lastSerial = shown.reduce((latest, message) => Math.max(latest, message.serial), 0);

  useEffect(() => {
    if (lastSerial === 0) return;
    zone.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [lastSerial]);

  if (shown.length === 0) return null;
  return (
    <div ref={zone} className="action-reply" data-origin={origin}>
      {shown.map((message) => (
        <p key={`${message.tone}:${message.serial}`} className={classNames[message.tone]} role={message.tone === 'notice' ? 'status' : 'alert'}>
          {message.text}
        </p>
      ))}
    </div>
  );
}
