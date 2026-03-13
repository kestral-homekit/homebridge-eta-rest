export interface EtaRestV3Config {
  platform: string;
  name: string;
  baseUrl: string;
  username?: string;
  password?: string;
  pollInterval?: number;
  timeoutMs?: number;
  paths: {
    boilerFlowTemp: string;
    dhwTemp: string;
    outdoorTemp: string;
    boilerState?: string;
  };
  boiler?: {
    name?: string;
    activeThreshold?: number;
  };
  sensors?: {
    dhwName?: string;
    outdoorName?: string;
  };
}

export interface EtaSnapshot {
  boilerFlowTemp: number | null;
  dhwTemp: number | null;
  outdoorTemp: number | null;
  boilerState?: string | null;
  fetchedAt: string;
}

export interface EtaDatapointResponse {
  value: number | string | null;
  unit?: string;
  raw?: unknown;
}
