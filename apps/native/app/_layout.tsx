import "@/global.css";
import { env } from "@styx/env/native";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { registerHealthBackgroundSync } from "@/lib/health";

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

const convex = new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
  unsavedChangesWarning: false,
});

function StackLayout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  useEffect(() => {
    registerHealthBackgroundSync().catch((reason: unknown) => {
      console.error("Failed to register health background sync", reason);
    });
  }, []);

  return (
    <ConvexProvider client={convex}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <StackLayout />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ConvexProvider>
  );
}
