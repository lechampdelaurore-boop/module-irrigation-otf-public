
export class IrrigationEventInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrrigationEventInputError';
  }
}

export class IrrigationEventNotFoundError extends Error {
  constructor() {
    super('Cette irrigation est introuvable.');
    this.name = 'IrrigationEventNotFoundError';
  }
}

export class IrrigationEventStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrrigationEventStateError';
  }
}

export class IrrigationEquipmentAlreadyRunningError extends Error {
  constructor() {
    super('Ce matériel est déjà utilisé par une irrigation en cours.');
    this.name = 'IrrigationEquipmentAlreadyRunningError';
  }
}
