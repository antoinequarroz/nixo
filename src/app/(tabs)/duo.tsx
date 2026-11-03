import { DuoOnline } from '../../components/duo/DuoOnline';
import { DuoSimulated } from '../../components/duo/DuoSimulated';
import { isOnline } from '../../services/backend';

/** Real duo and witnesses when the server is configured, simulated otherwise. */
export default function Duo() {
  return isOnline ? <DuoOnline /> : <DuoSimulated />;
}
