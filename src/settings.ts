export const PLUGIN_NAME = 'homebridge-eta-rest-v3';
export const PLATFORM_NAME = 'EtaRestV3';

export const ACCESSORY_KEYS = {
  BOILER: 'eta-boiler',
  DHW: 'eta-dhw',
  OUTDOOR: 'eta-outdoor',
} as const;

export const DEFAULT_POLL_INTERVAL_SECONDS = 60;
export const DEFAULT_HTTP_TIMEOUT_MS = 5000;
export const DEFAULT_ACTIVE_THRESHOLD_C = 25;
