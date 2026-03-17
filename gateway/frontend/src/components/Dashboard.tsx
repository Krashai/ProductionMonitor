import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import type { PLC } from '../api';
import PLCCard from './PLCCard';
import PLCModal from './PLCModal';
import HallManagement from './HallManagement';
import { usePLCWebsocket } from '../hooks/useWebsocket';
import { Plus, LayoutDashboard, Cpu, Factory } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [plcs, setPlcs] = useState<PLC[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPLC, setSelectedPLC] = useState<PLC | null>(null);
  const [activeTab, setActiveTab] = useState<'plcs' | 'halls'>('plcs');

  // Pobieranie początkowych danych
  const fetchPlcs = async () => {
    try {
      const response = await api.get('/plcs');
      setPlcs(response.data);
    } catch (err) {
      console.error("Błąd pobierania PLC:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlcs();
  }, []);

  // Callback do aktualizacji stanu przez WebSocket
  const handlePLCUpdate = useCallback((updatedPLC: PLC) => {
    setPlcs(prev => prev.map(p => p.id === updatedPLC.id ? updatedPLC : p));
  }, []);

  usePLCWebsocket(handlePLCUpdate);

  const handleDelete = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten sterownik?')) {
      try {
        await api.delete(`/plcs/${id}`);
        setPlcs(prev => prev.filter(p => p.id !== id));
      } catch {
        alert('Błąd podczas usuwania');
      }
    }
  };

  const handleEdit = (plc: PLC) => {
    setSelectedPLC(plc);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPLC(null);
  };

  const handleAddClick = () => {
    setSelectedPLC(null);
    setIsModalOpen(true);
  };

  if (loading) return <div className="text-center mt-20 italic text-slate-500">Ładowanie konfiguracji...</div>;

  return (
    <div className="py-4">
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('plcs')}
          className={`pb-4 px-2 flex items-center gap-2 font-bold text-sm transition-all ${
            activeTab === 'plcs' 
              ? 'border-b-2 border-blue-600 text-blue-600' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Cpu size={18} />
          Sterowniki PLC
        </button>
        <button 
          onClick={() => setActiveTab('halls')}
          className={`pb-4 px-2 flex items-center gap-2 font-bold text-sm transition-all ${
            activeTab === 'halls' 
              ? 'border-b-2 border-blue-600 text-blue-600' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Factory size={18} />
          Hale Produkcyjne
        </button>
      </div>

      {activeTab === 'plcs' ? (
        <>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Twoje Sterowniki</h2>
            <button 
              onClick={handleAddClick}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-green-500/40 hover:scale-105 active:scale-95 font-semibold"
            >
              <Plus size={20} />
              Dodaj PLC
            </button>
          </div>

          <PLCModal 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
            onSuccess={fetchPlcs}
            initialData={selectedPLC}
          />

          {plcs.length === 0 ? (
            <div className="bg-white py-16 px-8 rounded-2xl shadow-sm text-center border border-gray-100 flex flex-col items-center">
              <div className="bg-indigo-50 p-4 rounded-full mb-6">
                <LayoutDashboard size={48} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Brak sterowników PLC</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                Zacznij od dodania swojego pierwszego sterownika PLC, aby monitorować dane w czasie rzeczywistym.
              </p>
              <button 
                onClick={handleAddClick}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-green-500/40 hover:scale-105 active:scale-95 font-semibold"
              >
                <Plus size={20} />
                Dodaj PLC
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plcs.map(plc => (
                <PLCCard key={plc.id} plc={plc} onDelete={handleDelete} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </>
      ) : (
        <HallManagement />
      )}
    </div>
  );
};

export default Dashboard;
