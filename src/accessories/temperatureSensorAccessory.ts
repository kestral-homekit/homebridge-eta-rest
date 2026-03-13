import type {
  API,
  Logger,
  PlatformAccessory,
  Service,
  Characteristic,
} from 'homebridge';

export class TemperatureSensorAccessory {
  private readonly service: Service;
  private readonly Characteristic: typeof Characteristic;

  constructor(
    private readonly log: Logger,
    private readonly api: API,
    private readonly accessory: PlatformAccessory,
    private readonly displayName: string,
  ) {
    this.Characteristic = this.api.hap.Characteristic;

    this.service = this.accessory.getService(this.api.hap.Service.TemperatureSensor)
      ?? this.accessory.addService(this.api.hap.Service.TemperatureSensor, this.displayName);

    this.service.setPrimaryService(true);

    this.accessory.context.displayName = this.displayName;

    this.accessory.getService(this.api.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'ETA')
      .setCharacteristic(this.Characteristic.Model, 'REST Sensor V3')
      .setCharacteristic(this.Characteristic.SerialNumber, this.accessory.UUID);
  }

  public updateTemperature(value: number | null): void {
    if (value === null) {
      this.log.warn(`[${this.displayName}] temperature unavailable`);
      return;
    }

    const rounded = this.roundTemperature(value);

    this.service.updateCharacteristic(
      this.Characteristic.CurrentTemperature,
      rounded,
    );

    this.log.debug(`[${this.displayName}] updated to ${rounded}°C`);
  }

  private roundTemperature(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
