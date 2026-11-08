import { MAX_SETTINGS_PER_EQUIPMENT } from '@/lib/domain/irrigation-domain';

export class EquipmentNameAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Un matériel nommé « ${name} » existe déjà.`);
    this.name = 'EquipmentNameAlreadyExistsError';
  }
}

export class EquipmentKindLockedBySettingsError extends Error {
  constructor() {
    super('Supprimez les réglages existants avant de changer le type du matériel.');
    this.name = 'EquipmentKindLockedBySettingsError';
  }
}

export class EquipmentDuplicateKindMismatchError extends Error {
  constructor() {
    super('Le type du matériel dupliqué doit rester identique à l’original.');
    this.name = 'EquipmentDuplicateKindMismatchError';
  }
}

export class EquipmentSettingNameAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Un réglage nommé « ${name} » existe déjà pour ce matériel.`);
    this.name = 'EquipmentSettingNameAlreadyExistsError';
  }
}

export class EquipmentSettingsLimitError extends Error {
  constructor() {
    super(`Ce matériel possède déjà ses ${MAX_SETTINGS_PER_EQUIPMENT} réglages.`);
    this.name = 'EquipmentSettingsLimitError';
  }
}

export class EquipmentSettingKindMismatchError extends Error {
  constructor() {
    super('Le type du réglage ne correspond pas au type du matériel.');
    this.name = 'EquipmentSettingKindMismatchError';
  }
}
