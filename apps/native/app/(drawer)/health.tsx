import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Button } from "heroui-native";

import { Container } from "@/components/container";
import {
  getLastSyncSummary,
  isHealthKitAvailable,
  runHealthSync,
  type HealthSyncSummary,
} from "@/lib/health";

type HealthStatus = {
  isIOS: boolean;
  available: boolean;
};

function formatDateTime(timestampMs: number | undefined): string {
  if (timestampMs === undefined) {
    return "Never";
  }

  return new Date(timestampMs).toLocaleString();
}

export default function HealthScreen() {
  const [status, setStatus] = useState<HealthStatus>({
    isIOS: Platform.OS === "ios",
    available: false,
  });
  const [summary, setSummary] = useState<HealthSyncSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);

    const isIOS = Platform.OS === "ios";
    if (!isIOS) {
      setStatus({
        isIOS,
        available: false,
      });
      setSummary(null);
      setLoading(false);
      return;
    }

    const [available, storedSummary] = await Promise.all([
      isHealthKitAvailable(),
      getLastSyncSummary(),
    ]);

    setStatus({
      isIOS,
      available,
    });
    setSummary(storedSummary);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadState().catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : "Failed to load health state";
      setError(message);
      setLoading(false);
    });
  }, [loadState]);

  const runSyncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);

    try {
      const result = await runHealthSync();
      if (result.summary !== undefined) {
        setSummary(result.summary);
      }

      if (!result.supported || !result.authorized) {
        setError(result.error ?? "Unable to sync health data");
      }

      const available = await isHealthKitAvailable();
      setStatus({
        isIOS: Platform.OS === "ios",
        available,
      });
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "Health sync failed";
      setError(message);
    } finally {
      setSyncing(false);
    }
  }, []);

  const metricRows = useMemo(() => {
    if (summary === null) {
      return [];
    }

    return summary.metrics;
  }, [summary]);

  return (
    <Container className="p-4">
      <View className="py-6">
        <Text className="text-3xl font-semibold text-foreground tracking-tight">Health Sync</Text>
        <Text className="text-muted text-sm mt-1">
          iOS HealthKit sync with secure Convex ingest API.
        </Text>
      </View>

      {loading ? (
        <View className="rounded-lg border border-border p-4">
          <Text className="text-muted">Loading health status...</Text>
        </View>
      ) : null}

      {!loading && !status.isIOS ? (
        <View className="rounded-lg border border-warning p-4">
          <Text className="text-foreground font-medium">Unsupported Platform</Text>
          <Text className="text-muted mt-1">
            HealthKit sync is only available on iOS devices and iOS simulators.
          </Text>
        </View>
      ) : null}

      {!loading && status.isIOS ? (
        <View className="rounded-lg border border-border p-4 gap-2">
          <Text className="text-foreground font-medium">Permission + Availability</Text>
          <Text className="text-muted">Platform: iOS</Text>
          <Text className="text-muted">
            Health Data Available: {status.available ? "Yes" : "No"}
          </Text>
          <Text className="text-muted">
            Last Sync: {formatDateTime(summary?.completedAtMs)}
          </Text>

          <View className="mt-3">
            <Text className="text-foreground">Last Counters</Text>
            <Text className="text-muted">Inserted: {summary?.inserted ?? 0}</Text>
            <Text className="text-muted">Deduped: {summary?.deduped ?? 0}</Text>
            <Text className="text-muted">
              Recomputed days: {summary?.recomputedDays.length ?? 0}
            </Text>
          </View>

          <View className="mt-4">
            <Button
              isDisabled={syncing || !status.available}
              variant="primary"
              size="sm"
              onPress={() => {
                runSyncNow().catch(() => {
                  // handled in runSyncNow
                });
              }}
            >
              <Button.Label>{syncing ? "Syncing..." : "Sync Now"}</Button.Label>
            </Button>
          </View>

          {error !== null ? <Text className="text-danger mt-2">{error}</Text> : null}
        </View>
      ) : null}

      {metricRows.length > 0 ? (
        <View className="mt-4 rounded-lg border border-border p-4 gap-2">
          <Text className="text-foreground font-medium">Metric Results (Last Sync)</Text>
          {metricRows.map((metric) => (
            <View key={metric.metric} className="border-t border-border pt-2">
              <Text className="text-foreground text-sm">{metric.metric}</Text>
              <Text className="text-muted text-xs">Fetched: {metric.fetched}</Text>
              <Text className="text-muted text-xs">Uploaded: {metric.uploaded}</Text>
              <Text className="text-muted text-xs">Inserted: {metric.inserted}</Text>
              <Text className="text-muted text-xs">Deduped: {metric.deduped}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Container>
  );
}
