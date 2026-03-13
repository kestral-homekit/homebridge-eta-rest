import type { Logger } from 'homebridge';

import {
  DEFAULT_HTTP_TIMEOUT_MS,
} from './settings.js';
import type {
  EtaDatapointResponse,
  EtaRestV3Config,
  EtaSnapshot,
} from './types.js';

export class EtaClient {
  constructor(
    private readonly log: Logger,
    private readonly config: EtaRestV3Config,
  ) {}

  public async fetchSnapshot(): Promise<EtaSnapshot> {
    const boilerFlowTemp = await this.fetchNumber(this.config.paths.boilerFlowTemp);
    const dhwTemp = await this.fetchNumber(this.config.paths.dhwTemp);
    const outdoorTemp = await this.fetchNumber(this.config.paths.outdoorTemp);

    let boilerState: string | null = null;

    if (this.config.paths.boilerState) {
      const stateValue = await this.fetchValue(this.config.paths.boilerState);
      boilerState = stateValue?.value !== null && stateValue?.value !== undefined
        ? String(stateValue.value)
        : null;
    }

    return {
      boilerFlowTemp,
      dhwTemp,
      outdoorTemp,
      boilerState,
      fetchedAt: new Date().toISOString(),
    };
  }

  public async fetchNumber(path: string): Promise<number | null> {
    const result = await this.fetchValue(path);

    if (!result) {
      return null;
    }

    return this.coerceToNumber(result.value);
  }

  public async fetchValue(path: string): Promise<EtaDatapointResponse | null> {
    const url = this.buildUrl(path);
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json, application/xml, text/xml, */*',
      };

      if (this.config.username && this.config.password) {
        const credentials = Buffer
          .from(`${this.config.username}:${this.config.password}`)
          .toString('base64');
        headers.Authorization = `Basic ${credentials}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        this.log.warn(`ETA request failed for ${path}: HTTP ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      const rawText = await response.text();

      if (!rawText.trim()) {
        this.log.warn(`ETA request returned empty body for ${path}`);
        return null;
      }

      if (
        contentType.includes('xml')
        || rawText.trim().startsWith('<?xml')
        || rawText.includes('<eta')
        || rawText.includes('<value')
      ) {
        return this.parseEtaXml(rawText);
      }

      let parsed: unknown = rawText;

      if (contentType.includes('application/json') || this.looksLikeJson(rawText)) {
        try {
          parsed = JSON.parse(rawText);
        } catch (error) {
          this.log.warn(`ETA JSON parse failed for ${path}: ${this.errorMessage(error)}`);
          return null;
        }
      }

      return this.normalizeResponse(parsed);
    } catch (error) {
      this.log.warn(`ETA request failed for ${path}: ${this.errorMessage(error)}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(path: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${normalizedPath}`;
  }

  private parseEtaXml(xml: string): EtaDatapointResponse | null {
    const valueTagMatch = xml.match(/<value\b([^>]*)>(.*?)<\/value>/s);

    if (!valueTagMatch) {
      return {
        value: null,
        raw: xml,
      };
    }

    const attributes = valueTagMatch[1] ?? '';
    const innerText = (valueTagMatch[2] ?? '').trim();

    const strValue = this.readXmlAttribute(attributes, 'strValue');
    const unit = this.readXmlAttribute(attributes, 'unit') ?? undefined;

    if (strValue !== null) {
      return {
        value: strValue,
        unit,
        raw: xml,
      };
    }

    if (innerText) {
      return {
        value: innerText,
        unit,
        raw: xml,
      };
    }

    return {
      value: null,
      unit,
      raw: xml,
    };
  }

  private readXmlAttribute(attributes: string, name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = attributes.match(new RegExp(`${escapedName}="([^"]*)"`, 'i'));
    return match ? match[1] : null;
  }

  private normalizeResponse(raw: unknown): EtaDatapointResponse {
    if (raw === null || raw === undefined) {
      return {
        value: null,
        raw,
      };
    }

    if (typeof raw === 'number' || typeof raw === 'string') {
      return {
        value: raw,
        raw,
      };
    }

    if (typeof raw === 'object') {
      const record = raw as Record<string, unknown>;

      if ('value' in record) {
        return {
          value: this.normalizePrimitive(record.value),
          unit: this.readUnit(record),
          raw,
        };
      }

      if ('strValue' in record) {
        return {
          value: this.normalizePrimitive(record.strValue),
          unit: this.readUnit(record),
          raw,
        };
      }

      if ('numValue' in record) {
        return {
          value: this.normalizePrimitive(record.numValue),
          unit: this.readUnit(record),
          raw,
        };
      }

      if ('numericValue' in record) {
        return {
          value: this.normalizePrimitive(record.numericValue),
          unit: this.readUnit(record),
          raw,
        };
      }

      if ('node' in record && record.node && typeof record.node === 'object') {
        const nodeRecord = record.node as Record<string, unknown>;

        if ('value' in nodeRecord) {
          return {
            value: this.normalizePrimitive(nodeRecord.value),
            unit: this.readUnit(nodeRecord),
            raw,
          };
        }

        if ('strValue' in nodeRecord) {
          return {
            value: this.normalizePrimitive(nodeRecord.strValue),
            unit: this.readUnit(nodeRecord),
            raw,
          };
        }
      }

      if ('result' in record && record.result && typeof record.result === 'object') {
        const resultRecord = record.result as Record<string, unknown>;

        if ('value' in resultRecord) {
          return {
            value: this.normalizePrimitive(resultRecord.value),
            unit: this.readUnit(resultRecord),
            raw,
          };
        }
      }
    }

    return {
      value: null,
      raw,
    };
  }

  private normalizePrimitive(value: unknown): number | string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return String(value);
  }

  private coerceToNumber(value: number | string | null): number | null {
    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = value
      .replace(',', '.')
      .replace(/[^\d.+-]/g, '');

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readUnit(record: Record<string, unknown>): string | undefined {
    const unit = record.unit ?? record.unitString ?? record.unitText;

    return typeof unit === 'string' ? unit : undefined;
  }

  private looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
