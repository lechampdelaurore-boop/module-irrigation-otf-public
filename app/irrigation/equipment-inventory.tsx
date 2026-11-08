'use client';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import type { EquipmentKind, EquipmentMobility } from '@/lib/domain/irrigation-domain';
import { sortByNameNaturally } from '@/lib/domain/bed-order';
import { archiveEquipmentAction, deleteEquipmentAction, restoreEquipmentAction, saveEquipmentAction } from './equipment-actions';
import { EquipmentPoseStatus, currentPoseOf, type EquipmentPoseContext } from './equipment-pose';
import { EquipmentSettingPicker } from './equipment-setting-picker';
import { poseCounts } from '@/lib/domain/equipment-pose-presentation';
import { EquipmentSettingsDialog } from './equipment-settings-dialog';
import type { CalculatorContext } from './irrigation-calculator/calculator-context';
import { Icon } from './line-icon';

type Props = {
  equipment: EquipmentListItem[];
  placements: EquipmentPlacementRecord[];
  poseContext: EquipmentPoseContext;
  onStartPlacement: (equipmentId: string) => void;
  onPlacementChanged: (placement: EquipmentPlacementRecord) => void;
  calculator: CalculatorContext | null;
};

export type EquipmentInventoryAction =
  | 'settings'
  | 'edit'
  | 'duplicate'
  | 'archive'
  | 'delete';

export type EquipmentInventoryHandle = {
  runAction: (
    equipmentId: string,
    action: EquipmentInventoryAction,
  ) => void;
};

type EditorState = {
  mode: 'create' | 'edit' | 'duplicate';
  id: string | null;
  name: string;
  kind: EquipmentKind;
  mobility: EquipmentMobility;
  settingsCount: number;
};

export const EquipmentInventory = forwardRef<EquipmentInventoryHandle, Props>(
  function EquipmentInventory({
    equipment,
    placements,
    poseContext,
    onStartPlacement,
    onPlacementChanged,
    calculator,
  }, ref) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [settingsEquipmentId, setSettingsEquipmentId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dans l'ordre naturel des noms : gag9 avant gag10 (audit ergonomique, point 4).
  const sortedEquipment = sortByNameNaturally(equipment, (item) => item.name, (item) => item.id);
  const activeEquipment = sortedEquipment.filter((item) => item.status === 'active');
  const archivedEquipment = sortedEquipment.filter(
    (item) => item.status === 'archived',
  );
  const placementByEquipmentId = new Map(
    placements.map((placement) => [placement.equipmentId, placement]),
  );
  const sprinklerCount = activeEquipment.filter(
    (item) => item.kind === 'sprinkler',
  ).length;
  const dripCount = activeEquipment.length - sprinklerCount;
  // Un matériel archivé garde sa position : seuls les matériels actifs comptent.
  const counts = poseCounts(activeEquipment.map((item) => item.id), poseContext.poses);
  const settingsEquipment = settingsEquipmentId
    ? equipment.find((item) => item.id === settingsEquipmentId) ?? null
    : null;

  useEffect(() => {
    if (!editor) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) setEditor(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editor, isPending]);

  useEffect(() => {
    const closeMenusOutside = (event: PointerEvent) => {
      const target = event.target;
      document
        .querySelectorAll<HTMLDetailsElement>(
          '.equipment-menu[open], .plan-equipment-menu[open]',
        )
        .forEach((menu) => {
          if (!(target instanceof Node) || !menu.contains(target)) {
            menu.removeAttribute('open');
          }
        });
    };
    const closeMenusWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      document
        .querySelectorAll<HTMLDetailsElement>(
          '.equipment-menu[open], .plan-equipment-menu[open]',
        )
        .forEach((menu) => {
          menu.removeAttribute('open');
          menu.querySelector<HTMLElement>('summary')?.focus();
        });
    };

    document.addEventListener('pointerdown', closeMenusOutside);
    document.addEventListener('keydown', closeMenusWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenusOutside);
      document.removeEventListener('keydown', closeMenusWithEscape);
    };
  }, []);

  const existingNames = useMemo(
    () => new Set(equipment.map((item) => item.name.toLocaleLowerCase('fr-FR'))),
    [equipment],
  );

  const openCreate = () => {
    clearMessages();
    setEditor({
      mode: 'create',
      id: null,
      name: '',
      kind: 'sprinkler',
      mobility: 'mobile',
      settingsCount: 0,
    });
  };

  const openEdit = (item: EquipmentListItem) => {
    clearMessages();
    setEditor({
      mode: 'edit',
      id: item.id,
      name: item.name,
      kind: item.kind,
      mobility: item.mobility,
      settingsCount: item.settingsCount,
    });
  };

  const openDuplicate = (item: EquipmentListItem) => {
    clearMessages();
    setEditor({
      mode: 'duplicate',
      id: item.id,
      name: duplicateName(item.name, existingNames),
      kind: item.kind,
      mobility: item.mobility,
      settingsCount: item.settingsCount,
    });
  };

  const submitEquipment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveEquipmentAction({
        id: editor.mode === 'edit' ? editor.id : null,
        duplicateFromId: editor.mode === 'duplicate' ? editor.id : null,
        equipment: {
          name: String(form.get('name') ?? ''),
          kind: String(form.get('kind') ?? ''),
          mobility: String(form.get('mobility') ?? ''),
        },
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setEditor(null);
      setNotice(result.message);
    });
  };

  const archiveEquipment = (item: EquipmentListItem) => {
    if (
      !window.confirm(
        `Archiver « ${item.name} » ? Son historique sera conservé.`,
      )
    ) {
      return;
    }

    clearMessages();
    startTransition(async () => {
      const result = await archiveEquipmentAction(item.id);
      if (result.ok) {
        setNotice(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const restoreEquipment = (item: EquipmentListItem) => {
    clearMessages();
    startTransition(async () => {
      const result = await restoreEquipmentAction(item.id);
      if (result.ok) {
        setNotice(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const deleteEquipment = (item: EquipmentListItem) => {
    if (
      !window.confirm(
        `Supprimer définitivement « ${item.name} » ? Cette action est irréversible.`,
      )
    ) {
      return;
    }

    clearMessages();
    startTransition(async () => {
      const result = await deleteEquipmentAction(item.id);
      if (result.ok) {
        setNotice(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const clearMessages = () => {
    setNotice(null);
    setError(null);
  };

  const openSettings = (item: EquipmentListItem) => {
    clearMessages();
    setSettingsEquipmentId(item.id);
  };

  useImperativeHandle(ref, () => ({
    runAction(equipmentId, action) {
      const item = equipment.find((candidate) => candidate.id === equipmentId);
      if (!item) return;
      if (action === 'settings') openSettings(item);
      if (action === 'edit') openEdit(item);
      if (action === 'duplicate') openDuplicate(item);
      if (action === 'archive') archiveEquipment(item);
      if (action === 'delete') deleteEquipment(item);
    },
  }));

  return (
    <section className="equipment-section" aria-labelledby="equipment-title">
      <header className="equipment-heading">
        <div>
          <small>Inventaire</small>
          <h2 id="equipment-title">Matériel d’irrigation</h2>
          <p>
            Chaque fiche correspond à un matériel physique présent sur la
            ferme.
          </p>
        </div>
        <button className="add-equipment-button" type="button" onClick={openCreate}>
          <Icon name="plus" />
          Ajouter un matériel
        </button>
      </header>

      <div className="equipment-summary" aria-label="Résumé de l’inventaire">
        <span><strong>{activeEquipment.length}</strong> matériel{activeEquipment.length > 1 ? 's' : ''} actif{activeEquipment.length > 1 ? 's' : ''}</span>
        <span><strong>{sprinklerCount}</strong> en aspersion</span>
        <span><strong>{dripCount}</strong> en goutte-à-goutte</span>
        <span><strong>{counts.posed}</strong> posé{counts.posed > 1 ? 's' : ''}</span>
        <span><strong>{counts.stored}</strong> stocké{counts.stored > 1 ? 's' : ''}</span>
      </div>

      {notice ? <p className="equipment-notice" role="status">{notice}</p> : null}
      {!editor && error ? <p className="equipment-error" role="alert">{error}</p> : null}

      {activeEquipment.length > 0 ? (
        <div className="equipment-list">
          {activeEquipment.map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              placement={placementByEquipmentId.get(item.id) ?? null}
              poseStatus={<EquipmentPoseStatus equipmentId={item.id} equipmentName={item.name} context={poseContext} disabled={isPending} />}
              stored={currentPoseOf(poseContext, item.id)?.removedAt != null}
              disabled={isPending}
              onPlacementChanged={onPlacementChanged}
              onPlace={() => onStartPlacement(item.id)}
              onEdit={() => openEdit(item)}
              onDuplicate={() => openDuplicate(item)}
              onSettings={() => openSettings(item)}
              onArchive={() => archiveEquipment(item)}
              onDelete={() => deleteEquipment(item)}
            />
          ))}
        </div>
      ) : (
        <div className="equipment-empty-state">
          <span className="equipment-empty-icon" aria-hidden="true">⌁</span>
          <strong>Aucun matériel enregistré</strong>
          <p>Commencez par identifier votre première rampe, ligne ou installation.</p>
          <button type="button" onClick={openCreate}>Ajouter le premier matériel</button>
        </div>
      )}

      {archivedEquipment.length > 0 ? (
        <div className="archived-equipment">
          <button
            className="archived-toggle"
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((visible) => !visible)}
          >
            <span aria-hidden="true">{showArchived ? '▾' : '▸'}</span>
            Matériels archivés ({archivedEquipment.length})
          </button>
          {showArchived ? (
            <div className="equipment-list" data-archived="true">
              {archivedEquipment.map((item) => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  placement={null}
                  disabled={isPending}
                  onDuplicate={() => openDuplicate(item)}
                  onRestore={() => restoreEquipment(item)}
                  onDelete={() => deleteEquipment(item)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {editor ? (
        <EquipmentDialog
          key={`${editor.mode}-${editor.id ?? 'new'}`}
          editor={editor}
          error={error}
          isPending={isPending}
          onCancel={() => !isPending && setEditor(null)}
          onSubmit={submitEquipment}
        />
      ) : null}
      {settingsEquipment ? (
        <EquipmentSettingsDialog
          equipment={settingsEquipment}
          calculator={calculator}
          onClose={() => setSettingsEquipmentId(null)}
        />
      ) : null}
    </section>
  );
});

function EquipmentCard({
  item,
  placement,
  poseStatus,
  stored = false,
  disabled,
  onPlacementChanged,
  onPlace,
  onEdit,
  onDuplicate,
  onSettings,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: EquipmentListItem;
  placement: EquipmentPlacementRecord | null;
  poseStatus?: ReactNode;
  stored?: boolean;
  disabled: boolean;
  onPlacementChanged?: (placement: EquipmentPlacementRecord) => void;
  onPlace?: () => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onSettings?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}) {
  const archived = item.status === 'archived';
  const canPlace = Boolean(onPlace && item.settingsCount > 0 && !archived);

  const startDrag = (event: ReactDragEvent<HTMLElement>) => {
    if (!canPlace || !onPlace) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-irrigation-equipment', item.id);
    event.dataTransfer.setData('text/plain', item.id);
    onPlace();
  };

  return (
    <article
      className="equipment-card"
      data-kind={item.kind}
      data-archived={archived}
      data-placeable={canPlace}
      draggable={canPlace}
      onDragStart={startDrag}
    >
      <span className="equipment-kind-mark" aria-hidden="true">
        {item.kind === 'sprinkler' ? 'ASP' : 'GÀG'}
      </span>
      <div className="equipment-card-copy">
        <strong>{item.name}</strong>
        <span>
          {kindLabel(item.kind)} · {mobilityLabel(item.mobility)}
        </span>
      </div>
      {onPlace ? (
        <button
          className="equipment-place-button"
          type="button"
          disabled={disabled || !canPlace}
          onClick={onPlace}
          title={
            item.settingsCount === 0
              ? 'Ajoutez d’abord un réglage.'
              : placement
                ? 'Déplacer ce matériel sur le plan'
                : stored ? 'Reposer ce matériel, à sa dernière place par défaut' : 'Placer ce matériel sur le plan'
          }
        >
          {placement ? 'Déplacer' : stored ? 'Reposer' : 'Placer'}
        </button>
      ) : null}
      <button
        className="equipment-setting-count"
        type="button"
        disabled={disabled || !onSettings}
        onClick={onSettings}
      >
        <strong>{item.settingsCount}</strong>
        <span>réglage{item.settingsCount > 1 ? 's' : ''}</span>
      </button>
      {poseStatus}
      {placement && onPlacementChanged ? (
        <EquipmentSettingPicker
          settings={item.settings}
          placement={placement}
          disabled={disabled}
          onPlacementChanged={onPlacementChanged}
        />
      ) : null}
      {archived ? <span className="archived-badge">Archivé</span> : null}
      <details
        className="equipment-menu"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            closeOtherEquipmentMenus(event.currentTarget);
          }
        }}
      >
        <summary aria-label={`Actions pour ${item.name}`} title="Actions">⋮</summary>
        <div role="menu">
          {onSettings ? <button type="button" role="menuitem" disabled={disabled} onClick={(event) => runMenuAction(event, onSettings)}>Configurer les réglages</button> : null}
          {onEdit ? <button type="button" role="menuitem" disabled={disabled} onClick={(event) => runMenuAction(event, onEdit)}>Modifier</button> : null}
          <button type="button" role="menuitem" disabled={disabled} onClick={(event) => runMenuAction(event, onDuplicate)}>Dupliquer</button>
          {onArchive ? <button className="archive-action" type="button" role="menuitem" disabled={disabled} onClick={(event) => runMenuAction(event, onArchive)}>Archiver</button> : null}
          {onRestore ? <button type="button" role="menuitem" disabled={disabled} onClick={(event) => runMenuAction(event, onRestore)}>Restaurer</button> : null}
          <button className="delete-action" type="button" role="menuitem" disabled={disabled} onClick={(event) => runMenuAction(event, onDelete)}>Supprimer définitivement</button>
        </div>
      </details>
    </article>
  );
}

function EquipmentDialog({
  editor,
  error,
  isPending,
  onCancel,
  onSubmit,
}: {
  editor: EditorState;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const title =
    editor.mode === 'edit'
      ? 'Modifier le matériel'
      : editor.mode === 'duplicate'
        ? 'Dupliquer le matériel'
        : 'Ajouter un matériel';

  return (
    <div className="equipment-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section
        className="equipment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-dialog-title"
      >
        <header>
          <div>
            <small>Inventaire</small>
            <h3 id="equipment-dialog-title">{title}</h3>
          </div>
          <button type="button" disabled={isPending} onClick={onCancel} aria-label="Fermer">×</button>
        </header>
        <form onSubmit={onSubmit}>
          <label className="equipment-field">
            <span>Nom du matériel</span>
            <input
              autoFocus
              required
              maxLength={80}
              name="name"
              defaultValue={editor.name}
              placeholder="Ex. Rampe d’aspersion 1"
            />
          </label>

          <fieldset className="equipment-choice-group">
            <legend>Type d’irrigation</legend>
            {editor.mode === 'duplicate' ? (
              <input type="hidden" name="kind" value={editor.kind} />
            ) : null}
            <label>
              <input type="radio" name="kind" value="sprinkler" disabled={editor.mode === 'duplicate'} defaultChecked={editor.kind === 'sprinkler'} />
              <span><strong>Aspersion</strong><small>Répartition selon la distance</small></span>
            </label>
            <label>
              <input type="radio" name="kind" value="drip" disabled={editor.mode === 'duplicate'} defaultChecked={editor.kind === 'drip'} />
              <span><strong>Goutte-à-goutte</strong><small>Apport uniforme par planche</small></span>
            </label>
          </fieldset>

          <fieldset className="equipment-choice-group">
            <legend>Mobilité</legend>
            <label>
              <input type="radio" name="mobility" value="fixed" defaultChecked={editor.mobility === 'fixed'} />
              <span><strong>Fixe</strong><small>Installation permanente</small></span>
            </label>
            <label>
              <input type="radio" name="mobility" value="mobile" defaultChecked={editor.mobility === 'mobile'} />
              <span><strong>Mobile</strong><small>Déplacé entre les irrigations</small></span>
            </label>
          </fieldset>

          <p className="equipment-form-note">
            {editor.mode === 'duplicate'
              ? editor.settingsCount === 0
                ? 'Ce matériel ne possède aucun réglage à copier. Le placement et l’historique resteront indépendants.'
                : `Les ${editor.settingsCount} réglage${editor.settingsCount > 1 ? 's' : ''}, leurs débits et leurs profils seront copiés. Le placement et l’historique resteront indépendants.`
              : 'Après création, utilisez « Configurer les réglages » pour décrire les débits et les portées. Un type ne peut plus être changé tant que des réglages existent.'}
          </p>
          {error ? <p className="equipment-error" role="alert">{error}</p> : null}

          <footer>
            <button className="secondary-button" type="button" disabled={isPending} onClick={onCancel}>Annuler</button>
            <button className="primary-button" type="submit" disabled={isPending}>
              {isPending
                ? 'Enregistrement…'
                : editor.mode === 'edit'
                  ? 'Enregistrer'
                  : editor.mode === 'duplicate'
                    ? 'Dupliquer'
                    : 'Ajouter'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function duplicateName(name: string, existingNames: ReadonlySet<string>) {
  const firstCandidate = `${name} (copie)`;
  if (!existingNames.has(firstCandidate.toLocaleLowerCase('fr-FR'))) {
    return firstCandidate;
  }

  let copyNumber = 2;
  while (
    existingNames.has(`${name} (copie ${copyNumber})`.toLocaleLowerCase('fr-FR'))
  ) {
    copyNumber += 1;
  }
  return `${name} (copie ${copyNumber})`;
}

function kindLabel(kind: EquipmentKind) {
  return kind === 'sprinkler' ? 'Aspersion' : 'Goutte-à-goutte';
}

function mobilityLabel(mobility: EquipmentMobility) {
  return mobility === 'fixed' ? 'Fixe' : 'Mobile';
}

function closeOtherEquipmentMenus(currentMenu: HTMLDetailsElement) {
  document
    .querySelectorAll<HTMLDetailsElement>(
      '.equipment-menu[open], .plan-equipment-menu[open]',
    )
    .forEach((menu) => {
      if (menu !== currentMenu) menu.removeAttribute('open');
    });
}

function runMenuAction(
  event: ReactMouseEvent<HTMLButtonElement>,
  action: () => void,
) {
  event.currentTarget.closest<HTMLDetailsElement>('details')?.removeAttribute('open');
  action();
}
