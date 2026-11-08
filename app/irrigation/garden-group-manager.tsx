'use client';

import type { GardenGroupMemberRecord, GardenGroupRecord } from '@/lib/domain/garden-group-record';
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import type { Bed, Plot, Zone } from '@/lib/domain/domain';
import { sortBedsByName } from '@/lib/domain/bed-order';
import type { GardenBedOrder } from '@/lib/domain/garden-group-domain';
import {
  deleteGardenGroupAction,
  saveGardenGroupAction,
} from './garden-group-actions';
import { Icon } from './line-icon';
import { GardenGroupDiagram } from './garden-group-diagram';
import { useSectionHelp } from './shell/section-help';
import { GARDEN_GROUP_HELP } from '@/lib/domain/features/help';

type Props = {
  season: number;
  groups: GardenGroupRecord[];
  copiedFromSeason: number | null;
  plots: Plot[];
  beds: Bed[];
  zones: Zone[];
};

type MemberEditor = {
  otfZoneId: string;
  otfPlotId: string;
  bedOrder: GardenBedOrder;
  gapBeforeMeters: string;
};

type GroupEditor = {
  id: string | null;
  name: string;
  members: MemberEditor[];
  gardenToAdd: string;
};

const distanceFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function GardenGroupManager({
  season,
  groups,
  copiedFromSeason,
  plots,
  beds,
  zones,
}: Props) {
  const [editor, setEditor] = useState<GroupEditor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupHelp = useSectionHelp('Groupes de jardins alignés', GARDEN_GROUP_HELP, <GardenGroupDiagram label={GARDEN_GROUP_HELP.figureLabel ?? ''} />);
  const plotById = useMemo(
    () => new Map(plots.map((plot) => [plot.id, plot])),
    [plots],
  );
  const zoneById = useMemo(
    () => new Map(zones.map((zone) => [zone.id, zone])),
    [zones],
  );
  const groupedPlotIds = useMemo(
    () =>
      new Set(
        groups.flatMap((group) =>
          group.members.map((member) => member.otfPlotId),
        ),
      ),
    [groups],
  );
  const ungroupedPlots = plots.filter((plot) => !groupedPlotIds.has(plot.id));

  useEffect(() => {
    if (!editor) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) setEditor(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editor, isPending]);

  const openCreate = () => {
    clearMessages();
    setEditor({
      id: null,
      name: '',
      members: [],
      gardenToAdd: ungroupedPlots[0]?.id ?? '',
    });
  };

  const openEdit = (group: GardenGroupRecord) => {
    clearMessages();
    const occupiedElsewhere = new Set(
      groups
        .filter((item) => item.id !== group.id)
        .flatMap((item) => item.members.map((member) => member.otfPlotId)),
    );
    const firstAvailable = plots.find(
      (plot) =>
        !occupiedElsewhere.has(plot.id) &&
        !group.members.some((member) => member.otfPlotId === plot.id),
    );
    setEditor({
      id: group.id,
      name: group.name,
      members: group.members.map(memberToEditor),
      gardenToAdd: firstAvailable?.id ?? '',
    });
  };

  const submitGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    clearMessages();
    startTransition(async () => {
      const result = await saveGardenGroupAction({
        id: editor.id,
        group: {
          name: editor.name,
          season,
          members: editor.members.map((member) => ({
            otfZoneId: member.otfZoneId,
            otfPlotId: member.otfPlotId,
            bedOrder: member.bedOrder,
            gapBeforeMeters: parseDistance(member.gapBeforeMeters),
          })),
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

  const deleteGroup = (group: GardenGroupRecord) => {
    if (
      !window.confirm(
        `Supprimer le groupe « ${group.name} » ? Les jardins resteront disponibles dans le plan.`,
      )
    ) {
      return;
    }

    clearMessages();
    startTransition(async () => {
      const result = await deleteGardenGroupAction({ id: group.id, season });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
    });
  };

  const clearMessages = () => {
    setNotice(null);
    setError(null);
  };

  return (
    <section className="garden-groups-section" aria-labelledby="garden-groups-title">
      <header className="garden-groups-heading">
        <div>
          <small>Géométrie · saison {season}</small>
          <div className="section-title-row">
            <h2 id="garden-groups-title">Groupes de jardins alignés</h2>
            {groupHelp.toggle}
          </div>
          <p>
            Reliez les jardins qu’une même aspersion peut traverser, dans leur
            ordre physique réel.
          </p>
        </div>
        <button
          className="add-equipment-button"
          type="button"
          disabled={ungroupedPlots.length < 2 || isPending}
          title={
            ungroupedPlots.length < 2
              ? 'Deux jardins non groupés sont nécessaires.'
              : undefined
          }
          onClick={openCreate}
        >
          <Icon name="plus" />
          Créer un groupe
        </button>
      </header>
      {groupHelp.panel}

      {copiedFromSeason !== null ? (
        <p className="garden-copy-notice">
          Configuration reprise automatiquement de la saison {copiedFromSeason}.
          Vous pouvez l’adapter librement pour {season}.
        </p>
      ) : null}
      {notice ? <p className="equipment-notice" role="status">{notice}</p> : null}
      {!editor && error ? <p className="equipment-error" role="alert">{error}</p> : null}

      {groups.length > 0 ? (
        <div className="garden-group-list">
          {groups.map((group) => (
            <article className="garden-group-card" key={group.id}>
              <header>
                <div>
                  <strong>{group.name}</strong>
                  <span>{group.members.length} jardins ou abris alignés</span>
                </div>
                <div className="garden-group-actions">
                  <button type="button" disabled={isPending} onClick={() => openEdit(group)}>Modifier</button>
                  <button className="delete-action" type="button" disabled={isPending} onClick={() => deleteGroup(group)}>Supprimer</button>
                </div>
              </header>
              <div className="garden-chain">
                {group.members.map((member, index) => {
                  const plot = plotById.get(member.otfPlotId);
                  const zone = zoneById.get(member.otfZoneId);
                  return (
                    <Fragment key={member.otfPlotId}>
                      {index > 0 ? (
                        <span className="garden-gap">
                          <strong>{distanceFormatter.format(member.gapBeforeMeters)} m</strong>
                          <small>entre jardins</small>
                        </span>
                      ) : null}
                      <div className="garden-chain-item" data-order={member.bedOrder}>
                        <span aria-hidden="true">{member.bedOrder === 'normal' ? '→' : '←'}</span>
                        <div>
                          <strong>{plot?.name ?? 'Jardin indisponible'}</strong>
                          <small>{zone?.name ?? 'Parcelle inconnue'} · {member.bedOrder === 'normal' ? 'sens normal' : 'sens inversé'}</small>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="garden-groups-empty">
          <strong>Aucun groupe configuré pour {season}</strong>
          <p>
            Créez par exemple un groupe « Blocs 1 à 6 », puis ajoutez chaque
            jardin dans son ordre réel.
          </p>
        </div>
      )}

      <div className="ungrouped-gardens">
        <strong>Non groupés ({ungroupedPlots.length})</strong>
        <div>
          {ungroupedPlots.length > 0 ? ungroupedPlots.map((plot) => (
            <span key={plot.id}>{zoneById.get(plot.zoneId)?.name ?? 'Parcelle'} · {plot.name}</span>
          )) : <span>Tous les jardins appartiennent à un groupe.</span>}
        </div>
      </div>

      {editor ? (
        <GardenGroupDialog
          editor={editor}
          groups={groups}
          plots={plots}
          beds={beds}
          zones={zones}
          season={season}
          error={error}
          isPending={isPending}
          onChange={setEditor}
          onCancel={() => !isPending && setEditor(null)}
          onSubmit={submitGroup}
        />
      ) : null}
    </section>
  );
}

function GardenGroupDialog({
  editor,
  groups,
  plots,
  beds,
  zones,
  season,
  error,
  isPending,
  onChange,
  onCancel,
  onSubmit,
}: {
  editor: GroupEditor;
  groups: GardenGroupRecord[];
  plots: Plot[];
  beds: Bed[];
  zones: Zone[];
  season: number;
  error: string | null;
  isPending: boolean;
  onChange: (editor: GroupEditor) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const plotById = new Map(plots.map((plot) => [plot.id, plot]));
  const bedsByPlotId = new Map<string, Bed[]>();
  for (const bed of beds) {
    const plotBeds = bedsByPlotId.get(bed.plotId) ?? [];
    plotBeds.push(bed);
    bedsByPlotId.set(bed.plotId, plotBeds);
  }
  const occupiedElsewhere = new Set(
    groups
      .filter((group) => group.id !== editor.id)
      .flatMap((group) => group.members.map((member) => member.otfPlotId)),
  );
  const selectedPlotIds = new Set(
    editor.members.map((member) => member.otfPlotId),
  );
  const availablePlots = plots.filter(
    (plot) =>
      !occupiedElsewhere.has(plot.id) && !selectedPlotIds.has(plot.id),
  );

  const addGarden = () => {
    const plot = availablePlots.find((item) => item.id === editor.gardenToAdd);
    if (!plot) return;
    const remaining = availablePlots.filter((item) => item.id !== plot.id);
    onChange({
      ...editor,
      members: [
        ...editor.members,
        {
          otfZoneId: plot.zoneId,
          otfPlotId: plot.id,
          bedOrder: 'normal',
          gapBeforeMeters: editor.members.length === 0 ? '0' : '1.00',
        },
      ],
      gardenToAdd: remaining[0]?.id ?? '',
    });
  };

  const removeGarden = (plotId: string) => {
    const members = editor.members
      .filter((member) => member.otfPlotId !== plotId)
      .map((member, index) => ({
        ...member,
        gapBeforeMeters: index === 0 ? '0' : member.gapBeforeMeters,
      }));
    const firstAvailable = plots.find(
      (plot) =>
        !occupiedElsewhere.has(plot.id) &&
        !members.some((member) => member.otfPlotId === plot.id),
    );
    onChange({
      ...editor,
      members,
      gardenToAdd: firstAvailable?.id ?? '',
    });
  };

  const updateMember = (
    plotId: string,
    update: Partial<MemberEditor>,
  ) => {
    onChange({
      ...editor,
      members: editor.members.map((member) =>
        member.otfPlotId === plotId ? { ...member, ...update } : member,
      ),
    });
  };

  const moveGarden = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= editor.members.length) return;
    const members = [...editor.members];
    const gapsByPosition = members.map((member) => member.gapBeforeMeters);
    [members[index], members[target]] = [members[target], members[index]];
    onChange({
      ...editor,
      members: members.map((member, memberIndex) => ({
        ...member,
        gapBeforeMeters: memberIndex === 0 ? '0' : gapsByPosition[memberIndex],
      })),
    });
  };

  return (
    <div className="equipment-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="equipment-dialog garden-group-dialog" role="dialog" aria-modal="true" aria-labelledby="garden-group-dialog-title">
        <header>
          <div>
            <small>Géométrie · saison {season}</small>
            <h3 id="garden-group-dialog-title">{editor.id ? 'Modifier le groupe' : 'Nouveau groupe'}</h3>
          </div>
          <button type="button" disabled={isPending} onClick={onCancel} aria-label="Fermer">×</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="garden-group-form-scroll">
            <label className="equipment-field">
              <span>Nom du groupe</span>
              <input
                autoFocus
                required
                maxLength={80}
                value={editor.name}
                onChange={(event) => onChange({ ...editor, name: event.target.value })}
                placeholder="Ex. Blocs 1 à 6"
              />
            </label>

            <div className="garden-picker">
              <label>
                <span>Ajouter un jardin ou un abri</span>
                <select
                  value={
                    availablePlots.some((plot) => plot.id === editor.gardenToAdd)
                      ? editor.gardenToAdd
                      : availablePlots[0]?.id ?? ''
                  }
                  disabled={availablePlots.length === 0}
                  onChange={(event) => onChange({ ...editor, gardenToAdd: event.target.value })}
                >
                  {availablePlots.map((plot) => (
                    <option key={plot.id} value={plot.id}>
                      {zoneById.get(plot.zoneId)?.name ?? 'Parcelle'} · {plot.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={availablePlots.length === 0} onClick={addGarden}>Ajouter</button>
            </div>

            <div className="garden-members-editor">
              {editor.members.length > 0 ? editor.members.map((member, index) => {
                const plot = plotById.get(member.otfPlotId);
                const orderLabels = createBedOrderLabels(
                  sortBedsByName(bedsByPlotId.get(member.otfPlotId) ?? []),
                );
                return (
                  <article key={member.otfPlotId} className="garden-member-editor">
                    <span className="garden-member-position">{index + 1}</span>
                    <div className="garden-member-name">
                      <strong>{plot?.name ?? 'Jardin indisponible'}</strong>
                      <small>{zoneById.get(member.otfZoneId)?.name ?? 'Parcelle inconnue'}</small>
                    </div>
                    <div className="garden-member-order-buttons">
                      <button type="button" disabled={index === 0} onClick={() => moveGarden(index, -1)} aria-label={`Remonter ${plot?.name ?? 'le jardin'}`}>↑</button>
                      <button type="button" disabled={index === editor.members.length - 1} onClick={() => moveGarden(index, 1)} aria-label={`Descendre ${plot?.name ?? 'le jardin'}`}>↓</button>
                    </div>
                    <label className="garden-member-direction">
                      <span>Ordre physique des planches</span>
                      <select value={member.bedOrder} onChange={(event) => updateMember(member.otfPlotId, { bedOrder: event.target.value as GardenBedOrder })}>
                        <option value="normal">{orderLabels.normal}</option>
                        <option value="reversed">{orderLabels.reversed}</option>
                      </select>
                    </label>
                    <label className="garden-member-gap">
                      <span>{index === 0 ? 'Départ du groupe' : 'Distance avant'}</span>
                      <div className="unit-input compact-unit-input">
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={index === 0}
                          value={index === 0 ? '0' : member.gapBeforeMeters}
                          onChange={(event) => updateMember(member.otfPlotId, { gapBeforeMeters: event.target.value })}
                        />
                        <strong>m</strong>
                      </div>
                    </label>
                    <button className="garden-member-remove" type="button" onClick={() => removeGarden(member.otfPlotId)} aria-label={`Retirer ${plot?.name ?? 'le jardin'}`}>×</button>
                  </article>
                );
              }) : (
                <p className="garden-members-empty">Ajoutez les jardins un par un dans leur ordre physique.</p>
              )}
            </div>

            <p className="equipment-form-note">
              La distance est mesurée entre la fin du jardin précédent et le début
              du suivant. Le sens indique l’ordre physique des planches.
            </p>
            {error ? <p className="equipment-error" role="alert">{error}</p> : null}
          </div>
          <footer>
            <span className="garden-member-counter">{editor.members.length} jardin{editor.members.length > 1 ? 's' : ''}</span>
            <button className="secondary-button" type="button" disabled={isPending} onClick={onCancel}>Annuler</button>
            <button className="primary-button" type="submit" disabled={isPending || editor.members.length < 2}>
              {isPending ? 'Enregistrement…' : editor.id ? 'Enregistrer' : 'Créer le groupe'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function createBedOrderLabels(beds: Bed[]) {
  const firstName = beds[0]?.name.trim();
  const lastName = beds.at(-1)?.name.trim();

  if (firstName && lastName && firstName !== lastName) {
    return {
      normal: `${firstName} → ${lastName}`,
      reversed: `${lastName} → ${firstName}`,
    };
  }

  return {
    normal: 'De la première à la dernière',
    reversed: 'De la dernière à la première',
  };
}

function memberToEditor(member: GardenGroupMemberRecord): MemberEditor {
  return {
    otfZoneId: member.otfZoneId,
    otfPlotId: member.otfPlotId,
    bedOrder: member.bedOrder,
    gapBeforeMeters: String(member.gapBeforeMeters),
  };
}

function parseDistance(value: string) {
  if (!value.trim()) return Number.NaN;
  return Number(value.replace(',', '.'));
}
