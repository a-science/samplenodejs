import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
// import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { logs } from "@opentelemetry/api-logs";
import { BatchSpanProcessor, SamplingResult } from "@opentelemetry/sdk-trace-base";
import { Sampler, SamplingDecision } from "@opentelemetry/sdk-trace-base";
import { Context, SpanKind, Attributes, Link } from "@opentelemetry/api";

// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const BASE_URL = "https://otel.kloudmate.com:4318";
const SERVICE_NAME = "node-autoinstumentation";

class CustomSampler implements Sampler {
  shouldSample(context: Context, traceId: string, spanName: string, spanKind: SpanKind, attributes: Attributes, links: Link[]): SamplingResult {
    if((attributes['http.url'] as string)?.endsWith('/v1/logs'))
      return {decision: SamplingDecision.NOT_RECORD}
    
    return {decision: SamplingDecision.RECORD_AND_SAMPLED, attributes}
  }

  toString(): string {
    return 'custom sampler'
  }
}

const exporterConfig = {
  headers: {
    Authorization: "sk_oBYCM4YAci6wn6Z8KZyfvP5f",
  },
};

const loggerProvider = new LoggerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  }),
});
loggerProvider.addLogRecordProcessor(
  new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: `${BASE_URL}/v1/logs`,
      ...exporterConfig,
    })
  )
);

logs.setGlobalLoggerProvider(loggerProvider);

const metricExporter = new OTLPMetricExporter({
  url: `${BASE_URL}/v1/metrics`,
  ...exporterConfig,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 1000,
  }),
  sampler: new CustomSampler(),
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: `${BASE_URL}/v1/traces`,
      ...exporterConfig,
    })
  ),
  instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }
  )],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("Tracing terminated"))
    .catch((error) => console.log("Error terminating tracing", error))
    .finally(() => process.exit(0));
});
