import React, { useState, useEffect } from 'react';
import { getHalls, createHall, deleteHall, Hall } from '../api';
import { Factory, Plus, Loader2, Trash2 } from 'lucide-react';

const HallManagement: React.FC = () => {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHallName, setNewHallName] = useState('');
  const [newHallId, setNewHallId] = useState('');
  const [error, setError] = useState('');

  const fetchHalls = async () => {
    try {
      const res = await getHalls();
      setHalls(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHalls();
  }, []);

  const handleAddHall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newHallId || !newHallName) return;
    
    try {
      await createHall({ id: newHallId, name: newHallName });
      setNewHallId('');
      setNewHallName('');
      fetchHalls();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Błąd dodawania hali');
    }
  };

  const handleDeleteHall = async (id: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę halę?')) return;
    
    setError('');
    try {
      await deleteHall(id);
      fetchHalls();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Błąd usuwania hali');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-700 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus size={20} className="text-green-600" /> Dodaj Nową Halę
        </h3>
        <form onSubmit={handleAddHall} className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">ID Hali</label>
            <input 
              value={newHallId}
              onChange={e => setNewHallId(e.target.value)}
              placeholder="np. HALA_1"
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nazwa Hali</label>
            <input 
              value={newHallName}
              onChange={e => setNewHallName(e.target.value)}
              placeholder="np. Hala Produkcyjna 1"
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            />
          </div>
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold transition-all"
          >
            Dodaj
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {halls.map(hall => (
          <div key={hall.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <Factory size={24} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{hall.name}</h4>
                <p className="text-xs text-gray-500 font-mono">{hall.id}</p>
              </div>
            </div>
            <button 
              onClick={() => handleDeleteHall(hall.id)}
              className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              title="Usuń halę"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HallManagement;
