import React, { useEffect } from "react";
import { AppState, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import Svg, { Path } from "react-native-svg";

// Import Screens
import MapScreen from "./src/screens/MapScreen";
import NavigateScreen from "./src/screens/NavigateScreen";
import SavedScreen from "./src/screens/SavedScreen";

// Import Components
import { ErrorBoundary } from "./src/components/ErrorBoundary";

// Import Services
import { voiceService } from "./src/services/voiceService";
import {
  registerBackgroundTask,
  syncNavigationStateFromStorage,
} from "./src/services/backgroundNavigation";
import { preloadPopularRoutes } from "./src/services/routeCache";

// Navigation Parameter List Definition
export type RootTabParamList = {
  Home: undefined;
  Navigate: undefined;
  Saved: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const RCCG_RED = "#8B0000";
const INACTIVE_GRAY = "#777777";

function TabIcon({
  name,
  color,
}: {
  name: keyof RootTabParamList;
  color: string;
}) {
  const iconPath =
    name === "Home"
      ? "M12 2l8 4v16l-8-4-8 4V6l8-4zm1 3.62v10.62l5 2.5V8.24l-5-2.62zm-2 0L6 8.12v10.5l5-2.5V5.62z"
      : name === "Navigate"
        ? "M12 2l8 20-8-4-8 4 8-20zm0 5.46l-3.86 9.65L12 15.18l3.86 1.93L12 7.46z"
        : "M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1zm1 2v12.55l5-2.86 5 2.86V5H7z";

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d={iconPath} fill={color} />
    </Svg>
  );
}

export default function App() {
  useEffect(() => {
    // Initialize voice service on app start
    voiceService.initialize().catch((err) => {
      console.warn("[App] Voice service initialization failed:", err);
    });

    // Register background navigation task
    registerBackgroundTask();

    // Warm demo-critical routes without blocking the first screen.
    preloadPopularRoutes().catch((err) => {
      console.warn("[App] Popular route preload failed:", err);
    });

    // Handle app state changes for foreground/background transitions
    const subscription = AppState.addEventListener("change", handleAppState);

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle foreground/background transitions
  const handleAppState = async (nextAppState: string) => {
    if (nextAppState === "active") {
      // App came to foreground - re-sync navigation state if needed
      const navState = await syncNavigationStateFromStorage();
      if (navState && navState.isActive) {
        console.log(`[App] Navigation resumed: ${navState.destinationName}`);
      }
    } else if (nextAppState === "background") {
      // App going to background - navigation will continue via background task
      console.log("[App] App backgrounded - background navigation continues");
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer theme={DefaultTheme}>
          <Tab.Navigator
            initialRouteName="Home"
            screenOptions={({
              route,
            }: {
              route: { name: keyof RootTabParamList };
            }): BottomTabNavigationOptions => ({
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: RCCG_RED,
              tabBarInactiveTintColor: INACTIVE_GRAY,
              tabBarLabelStyle: styles.tabBarLabel,
              tabBarIcon: ({ color }: { color: string }) => (
                <TabIcon
                  name={route.name}
                  color={color}
                />
              ),
            })}
          >
            <Tab.Screen
              name="Home"
              component={MapScreen}
              options={{
                title: "Home",
              }}
            />
            <Tab.Screen
              name="Navigate"
              component={NavigateScreen}
              options={{
                title: "Navigate",
              }}
            />
            <Tab.Screen
              name="Saved"
              component={SavedScreen}
              options={{
                title: "Saved",
              }}
            />
          </Tab.Navigator>
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E5E5E5",
    minHeight: 64,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
