import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import { InterTight_400Regular } from '@expo-google-fonts/inter-tight/400Regular';
import { InterTight_500Medium } from '@expo-google-fonts/inter-tight/500Medium';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { Newsreader_300Light } from '@expo-google-fonts/newsreader/300Light';
import { Newsreader_300Light_Italic } from '@expo-google-fonts/newsreader/300Light_Italic';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GameProvider, useGame } from '../state/GameProvider';
import { colors } from '../theme';

function Root() {
  const { ready } = useGame();
  const [fontsLoaded] = useFonts({
    Newsreader_300Light,
    Newsreader_300Light_Italic,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    DMMono_400Regular,
    DMMono_500Medium,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
  });
  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.ground }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground }, animation: 'fade' }}>
      <Stack.Screen name="craving" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="light" />
        <Root />
      </GameProvider>
    </SafeAreaProvider>
  );
}
