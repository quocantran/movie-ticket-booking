import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

interface ConnectorResponse {
  name: string;
  config: Record<string, string>;
}

@Injectable()
export class DebeziumConnectorService implements OnApplicationBootstrap {
  private readonly debeziumHost = process.env.DEBEZIUM_HOST || 'localhost:8083';
  private readonly connectorName =
    process.env.DEBEZIUM_CONNECTOR_NAME || 'outbox-connector';
  private readonly autoRegister =
    (process.env.DEBEZIUM_AUTO_REGISTER || 'true').toLowerCase() === 'true';

  async onApplicationBootstrap(): Promise<void> {
    if (!this.autoRegister) return;

    try {
      await this.ensureConnector();
    } catch {}
  }

  private async ensureConnector(): Promise<void> {
    await this.waitForDebeziumReady();

    const existingConnectors = await this.fetchJson<string[]>(
      `${this.getBaseUrl()}/connectors`,
    );

    const connectorExists = existingConnectors.includes(this.connectorName);

    if (connectorExists) {
      await this.upsertConnectorConfig();
      await this.restartConnector();
      return;
    }

    if (existingConnectors.length > 0) return;

    const payload: ConnectorResponse = {
      name: this.connectorName,
      config: this.buildConnectorConfig(),
    };

    const response = await fetch(`${this.getBaseUrl()}/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Connector registration failed: ${response.status}: ${responseText}`,
      );
    }
  }

  private buildConnectorConfig(): Record<string, string> {
    return {
      'connector.class': 'io.debezium.connector.mysql.MySqlConnector',
      'tasks.max': '1',
      'database.hostname': process.env.DEBEZIUM_DB_HOST || 'mysql',
      'database.port': process.env.DEBEZIUM_DB_PORT || '3306',
      'database.user': process.env.DEBEZIUM_DB_USER || 'root',
      'database.password': process.env.DEBEZIUM_DB_PASSWORD || '123456',
      'database.server.id': process.env.DEBEZIUM_DB_SERVER_ID || '1',
      'topic.prefix': process.env.DEBEZIUM_TOPIC_PREFIX || 'saga',
      'database.include.list': 'booking_db,seat_db,payment_db,movie_db',
      'table.include.list': 'booking_db.outbox,seat_db.outbox,payment_db.outbox,movie_db.outbox',
      'schema.history.internal.kafka.bootstrap.servers':
        process.env.DEBEZIUM_SCHEMA_HISTORY_BOOTSTRAP || 'kafka:9092',
      'schema.history.internal.kafka.topic':
        process.env.DEBEZIUM_SCHEMA_HISTORY_TOPIC || '_schema_history_saga',
      'schema.history.internal.skip.unparseable.ddl': 'true',
      transforms: 'outbox',
      'transforms.outbox.type': 'io.debezium.transforms.outbox.EventRouter',
      'transforms.outbox.table.expand.json.payload': 'true',
      'transforms.outbox.table.field.event.id': 'id',
      'transforms.outbox.table.field.event.key': 'aggregate_id',
      'transforms.outbox.table.field.event.type': 'event_type',
      'transforms.outbox.table.field.event.payload': 'payload',
      'transforms.outbox.table.fields.additional.placement':
        'event_type:header:eventType',
      'transforms.outbox.route.by.field': 'aggregate_type',
      'transforms.outbox.route.topic.replacement': '${routedByValue}.events',
      'key.converter': 'org.apache.kafka.connect.storage.StringConverter',
      'value.converter': 'org.apache.kafka.connect.json.JsonConverter',
      'value.converter.schemas.enable': 'false',
      'tombstones.on.delete': 'false',
      'include.schema.changes': 'false',
    };
  }

  private async waitForDebeziumReady(): Promise<void> {
    const maxRetries = 30;
    const retryDelayMs = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetch(this.getBaseUrl());
        if (response.ok) return;
      } catch {}

      if (attempt === maxRetries) {
        throw new Error('Debezium not ready after max retries');
      }

      await this.sleep(retryDelayMs);
    }
  }

  private getBaseUrl(): string {
    if (this.debeziumHost.startsWith('http://') || this.debeziumHost.startsWith('https://')) {
      return this.debeziumHost;
    }
    return `http://${this.debeziumHost}`;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API call failed (${response.status}): ${text}`);
    }
    return (await response.json()) as T;
  }

  private async upsertConnectorConfig(): Promise<void> {
    const response = await fetch(
      `${this.getBaseUrl()}/connectors/${this.connectorName}/config`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildConnectorConfig()),
      },
    );

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Config update failed: ${response.status}: ${responseText}`);
    }
  }

  private async restartConnector(): Promise<void> {
    const response = await fetch(
      `${this.getBaseUrl()}/connectors/${this.connectorName}/restart`,
      { method: 'POST' },
    );

    if (!response.ok && response.status !== 204 && response.status !== 202) {
      const responseText = await response.text();
      throw new Error(`Restart failed: ${response.status}: ${responseText}`);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
