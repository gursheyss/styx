import * as BackgroundTask from "expo-background-task";
import { BackgroundTaskResult, BackgroundTaskStatus } from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { runHealthSync } from "./sync";

export const HEALTH_SYNC_TASK_NAME = "styx.health.sync";

if (!TaskManager.isTaskDefined(HEALTH_SYNC_TASK_NAME)) {
  TaskManager.defineTask(HEALTH_SYNC_TASK_NAME, async () => {
    try {
      const result = await runHealthSync();
      if (!result.supported) {
        return BackgroundTaskResult.Success;
      }
      if (!result.authorized) {
        return BackgroundTaskResult.Failed;
      }
      return BackgroundTaskResult.Success;
    } catch {
      return BackgroundTaskResult.Failed;
    }
  });
}

export async function registerHealthBackgroundSync(): Promise<void> {
  if (Platform.OS !== "ios") {
    return;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTaskStatus.Available) {
    return;
  }

  const registered = await TaskManager.isTaskRegisteredAsync(HEALTH_SYNC_TASK_NAME);
  if (registered) {
    return;
  }

  await BackgroundTask.registerTaskAsync(HEALTH_SYNC_TASK_NAME, {
    minimumInterval: 15,
  });
}
