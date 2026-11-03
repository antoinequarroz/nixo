import { Redirect } from 'expo-router';

import { useGame } from '../state/GameProvider';

export default function Index() {
  const { state } = useGame();
  return <Redirect href={state.profile ? '/home' : '/onboarding'} />;
}
