import React from 'react';
import type { PLC } from '../api';
import { Cpu, Activity, AlertCircle } from 'lucide-react';

interface PLCCardProps {
  plc: PLC;
  onDelete: (id: string) => void;
  onEdit: (plc: PLC) => void;
}

const PLCCard: React.FC<PLCCardProps> = ({ plc, onDelete, onEdit }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-blue-500">
      <div className="p-4 flex justify-between items-start bg-gray-50 border-b">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <Cpu size={20} className="text-blue-600" />
            {plc.name}
          </h3>
          <p className="text-sm text-gray-500 font-mono">{plc.ip} ({plc.type})</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
          plc.online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {plc.online ? <Activity size={14} /> : <AlertCircle size={14} />}
          {plc.online ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>
      
      <div className="p-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Tagi / Zmienne</h4>
        <div className="space-y-2">
          {plc.tags.length > 0 ? plc.tags.map((tag, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
              <span className="text-gray-700 font-medium">{tag.name}</span>
              <span className="font-mono bg-gray-100 px-2 rounded text-blue-700">
                {tag.value != null ? tag.value.toString() : '---'}
              </span>
            </div>
          )) : <p className="text-xs text-gray-400 italic">Brak zdefiniowanych tagów</p>}
        </div>
      </div>

      <div className="p-2 bg-gray-50 flex justify-end gap-2">
        <button 
          onClick={() => onEdit(plc)}
          className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition"
        >
          Edytuj
        </button>
        <button 
          onClick={() => onDelete(plc.id)}
          className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition"
        >
          Usuń sterownik
        </button>
      </div>
    </div>
  );
};

export default PLCCard;
