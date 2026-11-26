'use client';
import { useState } from 'react';
import { localDateTimeInputValue } from '@/lib/domain/irrigation-timer';
import { MILLISECONDS_PER_HOUR } from '@/lib/domain/units';
import type { IrrigationPreparationMode } from '../irrigation-event/contract';
import type { CreationKind } from './presentation';

/**
 * Ce que tape le maraîcher dans le formulaire d'« Arrosages », pour les trois
 * onglets : séparé du composant de la page quand le formulaire a pris son
 * propre fichier (simplification S5, PR 1, section 2). Les valeurs et leurs
 * premiers états sont ceux d'avant ; seul le retour au premier état après
 * une réussite ramène aussi le mode à « Objectif en mm », sans quantité :
 * aucune durée n'y reste choisie (F406, F899).
 */
export function useCreationForm(initialNowIso: string) {
  const [creationKind, setCreationKind] = useState<CreationKind>('running');
  // Aucun matériel présélectionné à l'ouverture (audit ergonomique, lot 3, point 6, cas 3) :
  // rien ne se calcule, et aucun cadre rouge ne paraît, avant un choix de l'utilisateur.
  const [equipmentId, setEquipmentId] = useState('');
  const [settingId, setSettingId] = useState('');
  const [pumpId, setPumpId] = useState('');
  const [pumpOriginId, setPumpOriginId] = useState('');
  const [preparationMode, setPreparationMode] = useState<IrrigationPreparationMode>('amount');
  // Rien d'office : la dose du jour arrive avec le choix d'un matériel, sinon le champ reste vide (lot G, n° 9, F409).
  const [targetMillimeters, setTargetMillimeters] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [referenceBedId, setReferenceBedId] = useState('');
  const [plannedStartAt, setPlannedStartAt] = useState(() =>
    localDateTimeInputValue(new Date(Date.parse(initialNowIso) + MILLISECONDS_PER_HOUR)),
  );
  const [actualStartAt, setActualStartAt] = useState(() =>
    localDateTimeInputValue(new Date(Date.parse(initialNowIso) - MILLISECONDS_PER_HOUR)),
  );
  const [actualEndAt, setActualEndAt] = useState(() => localDateTimeInputValue(new Date(initialNowIso)));
  const [note, setNote] = useState('');
  // « Saisir en mm » de « Plus d'options » (S5, section 3.4) : le champ « Combien ? » en millimètres.
  const [millimetersEntry, setMillimetersEntry] = useState(false);
  const [editingEventEquipmentId, setEditingEventEquipmentId] = useState<string | null>(null);

  /** Après une réussite, le formulaire se vide : rien ne se renvoie d'un second appui (F406). Les dates restent. */
  const reset = () => {
    setEquipmentId('');
    setSettingId('');
    setReferenceBedId('');
    setPumpId('');
    setPumpOriginId('');
    setPreparationMode('amount');
    setTargetMillimeters('');
    setDurationHours('1');
    setDurationMinutes('0');
    setNote('');
    setMillimetersEntry(false);
    setEditingEventEquipmentId(null);
  };

  return {
    creationKind, setCreationKind,
    equipmentId, setEquipmentId,
    settingId, setSettingId,
    pumpId, setPumpId,
    pumpOriginId, setPumpOriginId,
    preparationMode, setPreparationMode,
    targetMillimeters, setTargetMillimeters,
    durationHours, setDurationHours,
    durationMinutes, setDurationMinutes,
    referenceBedId, setReferenceBedId,
    plannedStartAt, setPlannedStartAt,
    actualStartAt, setActualStartAt,
    actualEndAt, setActualEndAt,
    note, setNote,
    millimetersEntry, setMillimetersEntry,
    editingEventEquipmentId, setEditingEventEquipmentId,
    reset,
  };
}

export type CreationForm = ReturnType<typeof useCreationForm>;
