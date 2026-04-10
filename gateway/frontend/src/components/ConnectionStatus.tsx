import React from 'react';
import { Radio, WifiOff, Loader2 } from 'lucide-react';
import type { WsStatus } from '../hooks/useWebsocket';

interface Props {
  status: WsStatus;
  lastEventAt: Date | null;
}

/**
 * Wskaźnik stanu kanału real-time dla gateway.
 * Operator musi widzieć, czy karty PLC pokazują żywe dane.
 */
const ConnectionStatus: React.FC<Props> = ({ status, lastEventAt }) => {
  const label =
    status === 'connected' ? 'LIVE' :
    status === 'connecting' ? 'ŁĄCZENIE' : 'OFFLINE';

  const Icon =
    status === 'connected' ? Radio :
    status === 'connecting' ? Loader2 : WifiOff;

  const classes =
    status === 'connected'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : status === 'connecting'
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-rose-50 border-rose-200 text-rose-700';

  const tooltip = lastEventAt
    ? `Ostatnia aktualizacja: ${lastEventAt.toLocaleTimeString('pl-PL')}`
    : 'Brak aktualizacji w tej sesji';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${classes}`}
      title={tooltip}
    >
      <Icon
        size={12}
        className={
          status === 'connected' ? 'animate-pulse' :
          status === 'connecting' ? 'animate-spin' : ''
        }
      />
      <span>{label}</span>
    </div>
  );
};

export default ConnectionStatus;
