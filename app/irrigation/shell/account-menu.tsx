'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * L'initiale ouvre le menu du compte (audit du 19 novembre 2026, lot G,
 * n° 6, F416 ; docs/charte-module.md) : le nom de la personne, puis « Se
 * déconnecter », le lien de toujours. Un appui sur l'initiale ne déconnecte
 * plus. Le menu se ferme par Échap, par un appui ailleurs ou sur l'initiale.
 */
export function AccountMenu({ userName, signOutPath }: { userName: string; signOutPath: string }) {
  const [open, setOpen] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!zone.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="account-menu-zone" ref={zone}>
      <button
        ref={button}
        type="button"
        className="avatar"
        aria-label={`Compte de ${userName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Compte"
        onClick={() => setOpen((value) => !value)}
      >
        {userName.slice(0, 1).toLocaleUpperCase('fr-FR')}
      </button>
      {open ? (
        <div className="account-menu" id={menuId} role="menu" aria-label="Compte">
          <p className="account-menu-name">{userName}</p>
          <a role="menuitem" href={signOutPath}>Se déconnecter</a>
        </div>
      ) : null}
    </div>
  );
}
