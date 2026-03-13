import type {
  API,
  Logger,
  PlatformAccessory,
  Service,
  Characteristic,
} from 'homebridge';

export class BoilerAccessory {
  private readonly service: Service;
  private readonly Characteristic: typeof Characteristic;

  constructor(
    private readonly log: Logger,
    private readonly api: API,
    private readonly accessory: PlatformAccessory,
    private readonly displayName: string,
    private readonly activeThreshold: number,
  ) {
    this.Characteristic = this.api.hap.Characteristic;

    this.service = this.accessory.getService(this.api.hap.Service.HeaterCooler)
      ?? this.accessory.addService(this.api.hap.Service.HeaterCooler, this.displayName);

    this.service.setPrimaryService(true);

    this.accessory.context.displayName = this.displayName;

    this.accessory.getService(this.api.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'ETA')
      .setCharacteristic(this.Characteristic.Model, 'REST Boiler V3')
      .setCharacteristic(this.Characteristic.SerialNumber, this.accessory.UUID);

    this.service.setCharacteristic(
      this.Characteristic.TargetHeaterCoolerState,
      this.Characteristic.TargetHeaterCoolerState.HEAT,
    );
  }

  public updateFromFlowTemperature(value: number | null): void {
    if (value === null) {
      this.log.warn(`[${this.displayName}] boiler temperature unavailable`);
      return;
    }

    const rounded = this.roundTemperature(value);
    const isHeating = rounded >= this.activeThreshold;

    this.service.updateCharacteristic(
      this.Characteristic.CurrentTemperature,
      rounded,
    );

    this.service.updateCharacteristic(
      this.Characteristic.Active,
      isHeating
        ? this.Characteristic.Active.ACTIVE
        : this.Characteristic.Active.INACTIVE,
    );

    this.service.updateCharacteristic(
      this.Characteristic.CurrentHeaterCoolerState,
      isHeating
        ? this.Characteristic.CurrentHeaterCoolerState.HEATING
        : this.Characteristic.CurrentHeaterCoolerState.INACTIVE,
    );

    this.service.updateCharacteristic(
      this.Characteristic.TargetHeaterCoolerState,
      this.Characteristic.TargetHeaterCoolerState.HEAT,
    );

    this.log.debug(
      `[${this.displayName}] flow=${rounded}°C, threshold=${this.activeThreshold}°C, heating=${isHeating}`,
    );
  }

  private roundTemperature(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
