import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { BoilerAccessory } from './accessories/boilerAccessory.js';
import { TemperatureSensorAccessory } from './accessories/temperatureSensorAccessory.js';
import {
  ACCESSORY_KEYS,
  DEFAULT_ACTIVE_THRESHOLD_C,
  DEFAULT_POLL_INTERVAL_SECONDS,
  PLATFORM_NAME,
  PLUGIN_NAME,
} from './settings.js';
import { EtaClient } from './eta-client.js';
import type { EtaRestV3Config, EtaSnapshot } from './types.js';

type ManagedAccessory = BoilerAccessory | TemperatureSensorAccessory;

export class EtaRestV3Platform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly accessories: PlatformAccessory[] = [];
  private readonly managedAccessories = new Map<string, ManagedAccessory>();
  private readonly configTyped: EtaRestV3Config;
  private readonly etaClient: EtaClient;
  private pollTimer?: NodeJS.Timeout;
  private lastSnapshot: EtaSnapshot | null = null;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.configTyped = this.config as EtaRestV3Config;
    this.etaClient = new EtaClient(this.log, this.configTyped);

    this.log.info('ETA REST V3 platform initialized');

    this.api.on('didFinishLaunching', () => {
      this.log.info('Homebridge finished launching, starting ETA REST V3');
      this.setupAccessories();
      void this.refreshOnce();
      this.startPolling();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info(`Restoring accessory from cache: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  private setupAccessories(): void {
    const desired = [
      {
        key: ACCESSORY_KEYS.BOILER,
        name: this.configTyped.boiler?.name ?? 'ETA Chaudière',
        type: 'boiler' as const,
      },
      {
        key: ACCESSORY_KEYS.DHW,
        name: this.configTyped.sensors?.dhwName ?? 'ETA Ballon ECS',
        type: 'sensor' as const,
      },
      {
        key: ACCESSORY_KEYS.OUTDOOR,
        name: this.configTyped.sensors?.outdoorName ?? 'ETA Température extérieure',
        type: 'sensor' as const,
      },
    ];

const desiredKeys = new Set<string>(desired.map(item => item.key));
    for (const cachedAccessory of this.accessories) {
      const accessoryKey = String(cachedAccessory.context.deviceKey ?? '');

      if (!desiredKeys.has(accessoryKey)) {
        this.log.info(`Removing obsolete accessory from cache: ${cachedAccessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
      }
    }

    for (const item of desired) {
      const uuid = this.api.hap.uuid.generate(item.key);
      let accessory = this.accessories.find(existing => existing.UUID === uuid);

      if (!accessory) {
        accessory = new this.api.platformAccessory(item.name, uuid);
        accessory.context.deviceKey = item.key;
        accessory.context.displayName = item.name;

        this.log.info(`Adding new accessory: ${item.name}`);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.push(accessory);
      } else {
        accessory.displayName = item.name;
        accessory.context.deviceKey = item.key;
        accessory.context.displayName = item.name;
        this.log.info(`Using cached accessory: ${item.name}`);
      }

      if (item.type === 'boiler') {
        const threshold = this.configTyped.boiler?.activeThreshold ?? DEFAULT_ACTIVE_THRESHOLD_C;
        this.managedAccessories.set(
          item.key,
          new BoilerAccessory(this.log, this.api, accessory, item.name, threshold),
        );
      } else {
        this.managedAccessories.set(
          item.key,
          new TemperatureSensorAccessory(this.log, this.api, accessory, item.name),
        );
      }
    }
  }

  private startPolling(): void {
    const pollIntervalSeconds = this.configTyped.pollInterval ?? DEFAULT_POLL_INTERVAL_SECONDS;
    const intervalMs = Math.max(10, pollIntervalSeconds) * 1000;

    this.log.info(`Starting ETA polling every ${intervalMs / 1000}s`);

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      void this.refreshOnce();
    }, intervalMs);
  }

  private async refreshOnce(): Promise<void> {
    try {
      const snapshot = await this.etaClient.fetchSnapshot();
      this.lastSnapshot = snapshot;
      this.applySnapshot(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.warn(`ETA refresh failed: ${message}`);
    }
  }

  private applySnapshot(snapshot: EtaSnapshot): void {
    const boiler = this.managedAccessories.get(ACCESSORY_KEYS.BOILER);
    const dhw = this.managedAccessories.get(ACCESSORY_KEYS.DHW);
    const outdoor = this.managedAccessories.get(ACCESSORY_KEYS.OUTDOOR);

    if (boiler instanceof BoilerAccessory) {
      boiler.updateFromFlowTemperature(snapshot.boilerFlowTemp);
    }

    if (dhw instanceof TemperatureSensorAccessory) {
      dhw.updateTemperature(snapshot.dhwTemp);
    }

    if (outdoor instanceof TemperatureSensorAccessory) {
      outdoor.updateTemperature(snapshot.outdoorTemp);
    }

    this.log.debug(
      `Snapshot applied: flow=${snapshot.boilerFlowTemp}, dhw=${snapshot.dhwTemp}, outdoor=${snapshot.outdoorTemp}`,
    );
  }
}
