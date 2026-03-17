import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, AlertCircle, Fingerprint, Network, Cpu, Layers, Settings, CheckCircle2, Wand2, Factory } from 'lucide-react';
import { createPLC, updatePLC, getHalls, Tag, PLC, Hall } from '../api';
import { PLC_PRESETS } from '../presets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: PLC | null;
}

const PLCModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [hallId, setHallId] = useState('');
  const [type, setType] = useState('S7-1200');
  const [rack, setRack] = useState(0);
  const [slot, setSlot] = useState(1);
  const [tags, setTags] = useState<Tag[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Pobierz listę hal
      getHalls().then(res => setHalls(res.data)).catch(console.error);

      if (initialData) {
        setId(initialData.id);
        setName(initialData.name);
        setIp(initialData.ip);
        setHallId(initialData.hall_id || '');
        setType(initialData.type);
        setRack(initialData.rack);
        setSlot(initialData.slot);
        setTags(initialData.tags || []);
      } else {
        setId('');
        setName('');
        setIp('');
        setHallId('');
        setType('S7-1200');
        setRack(0);
        setSlot(1);
        setTags([]);
      }
      setError('');
      setSuccessMsg('');
      setShowPresets(false);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const addTag = () => {
    setTags([...tags, { name: '', db: 1, offset: 0, bit: 0, type: 'REAL' }]);
  };

  const applyPreset = (presetTags: Omit<Tag, 'value'>[]) => {
    const existingNames = new Set(tags.map(t => t.name));
    const newTags = presetTags
      .filter(t => !existingNames.has(t.name))
      .map(t => ({ ...t }));

    if (newTags.length === 0) {
      setError('Wszystkie tagi z tego presetu są już dodane.');
      return;
    }

    setTags([...tags, ...newTags]);
    setShowPresets(false);
    setSuccessMsg(`Dodano ${newTags.length} tagów z presetu.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const updateTag = (index: number, field: keyof Tag, value: string | number | boolean) => {
    const newTags = [...tags];
    newTags[index] = { ...newTags[index], [field]: value };
    setTags(newTags);
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(row => row.trim() !== '');
      const dataRows = rows.slice(1);
      
      const newTags: Tag[] = [];
      const currentTagNames = new Set(tags.map(t => t.name));

      for (const row of dataRows) {
        const parts = row.split(',').map(s => s.trim());
        const tagName = parts[0];
        const db = parts[1];
        const offset = parts[2];
        let bit = '0';
        let type = '';

        if (parts.length >= 5) {
          bit = parts[3];
          type = parts[4];
        } else {
          type = parts[3];
        }

        if (!tagName || isNaN(parseInt(db)) || isNaN(parseInt(offset)) || !type) continue;
        
        if (currentTagNames.has(tagName)) {
           setError(`Duplikat tagu: ${tagName}`);
           return;
        }
        currentTagNames.add(tagName);
        
        const newTag: Tag = {
          name: tagName,
          db: parseInt(db),
          offset: parseInt(offset),
          type: type as Tag['type']
        };

        if (type === 'BOOL') {
          newTag.bit = parseInt(bit) || 0;
        }

        newTags.push(newTag);
      }
      setTags([...tags, ...newTags]);
      setError('');
      setSuccessMsg(`Pomyślnie zaimportowano ${newTags.length} tagów.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!id || !name || !ip || !hallId) {
      setError('Wypełnij pola ID, Nazwa, IP oraz wybierz Halę.');
      setLoading(false);
      return;
    }

    try {
      const payload = { id, name, ip, hall_id: hallId, type, rack, slot, tags };
      if (initialData) {
        await updatePLC(initialData.id, payload);
      } else {
        await createPLC(payload);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Błąd zapisu sterownika';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-500/30 ring-4 ring-blue-50">
              <Cpu size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {initialData ? 'Edytuj Sterownik PLC' : 'Dodaj Nowy Sterownik PLC'}
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                {initialData ? 'Zaktualizuj konfigurację sterownika' : 'Skonfiguruj połączenie z fizycznym sterownikiem'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-100"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-100 p-4 flex items-start gap-3 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
              <p className="text-emerald-700 text-sm font-medium">{successMsg}</p>
            </div>
          )}

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="plc-id" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">ID Sterownika</label>
              <div className="relative group">
                <Fingerprint className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                  id="plc-id"
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={!!initialData}
                  placeholder="np. PLC_01"
                  className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm ${
                    initialData ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="plc-name" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Nazwa</label>
              <div className="relative group">
                <Settings className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                  id="plc-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="np. Pakowarka"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="plc-ip" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Adres IP</label>
              <div className="relative group">
                <Network className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                  id="plc-ip"
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.0.10"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl font-mono focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-900"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="plc-hall" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Hala Produkcyjna</label>
              <div className="relative group">
                <Factory className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <select
                  id="plc-hall"
                  value={hallId}
                  onChange={(e) => setHallId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none text-gray-900"
                >
                  <option value="">Wybierz halę...</option>
                  {halls.map(hall => (
                    <option key={hall.id} value={hall.id}>{hall.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor="plc-type" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Typ Sterownika</label>
              <div className="relative group">
                <Cpu className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <select
                  id="plc-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none text-gray-900"
                >
                  <option value="S7-1200">S7-1200</option>
                  <option value="S7-1500">S7-1500</option>
                  <option value="S7-300">S7-300</option>
                  <option value="S7-400">S7-400</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="plc-rack" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Rack</label>
              <div className="relative group">
                <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                  id="plc-rack"
                  type="number"
                  value={rack}
                  onChange={(e) => setRack(parseInt(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-900"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="plc-slot" className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Slot</label>
              <div className="relative group">
                <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                  id="plc-slot"
                  type="number"
                  value={slot}
                  onChange={(e) => setSlot(parseInt(e.target.value) || 1)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-6 pt-6 border-t border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Tagi i Zmienne</h3>
                <p className="text-sm text-gray-500 font-medium">Zdefiniuj adresy pamięci do odczytu</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPresets(!showPresets)}
                    className="bg-purple-50 border border-purple-100 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-sm shadow-sm font-bold border-b-2 active:border-b-0 active:translate-y-0.5"
                  >
                    <Wand2 size={18} className="text-purple-600" />
                    Presety
                  </button>
                  
                  {showPresets && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-3 py-2 border-b border-gray-50 mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Wybierz Preset Tagów</p>
                      </div>
                      {PLC_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyPreset(preset.tags)}
                          className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors group"
                        >
                          <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{preset.name}</p>
                          <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label htmlFor="csv-upload" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer text-sm shadow-sm font-bold border-b-2 active:border-b-0 active:translate-y-0.5">
                  <Upload size={18} className="text-blue-600" />
                  Importuj CSV
                  <input id="csv-upload" type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={addTag}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-sm shadow-lg shadow-blue-500/20 font-bold border-b-2 border-blue-800 active:border-b-0 active:translate-y-0.5"
                >
                  <Plus size={18} />
                  Dodaj Tag
                </button>
              </div>
            </div>

            {tags.length === 0 ? (
              <div className="bg-gray-50/50 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 text-gray-400">
                <div className="bg-white w-16 h-16 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Plus size={32} className="text-gray-300" />
                </div>
                <p className="font-bold text-gray-500">Brak zdefiniowanych tagów</p>
                <p className="text-sm mt-1">Dodaj nowy tag ręcznie lub zaimportuj z pliku CSV</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2 pb-4">
                {tags.map((tag, index) => (
                  <div key={index} className="relative overflow-hidden bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      tag.type === 'REAL' ? 'bg-blue-500' :
                      tag.type === 'BOOL' ? 'bg-emerald-500' :
                      tag.type === 'INT' ? 'bg-amber-500' :
                      tag.type === 'DINT' ? 'bg-indigo-500' :
                      'bg-purple-500'
                    }`} />
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Nazwa Tagu</label>
                        <input
                          type="text"
                          value={tag.name}
                          onChange={(e) => updateTag(index, 'name', e.target.value)}
                          placeholder="np. Temperatura"
                          className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-gray-900"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">DB</label>
                        <input
                          type="number"
                          value={tag.db}
                          onChange={(e) => updateTag(index, 'db', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-gray-900"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Offset</label>
                        <input
                          type="number"
                          value={tag.offset}
                          onChange={(e) => updateTag(index, 'offset', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-gray-900"
                        />
                      </div>
                      {tag.type === 'BOOL' ? (
                        <>
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Bit</label>
                            <input
                              type="number"
                              min="0"
                              max="7"
                              value={tag.bit ?? 0}
                              onChange={(e) => updateTag(index, 'bit', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-gray-900"
                            />
                          </div>
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Typ Danych</label>
                            <select
                              value={tag.type}
                              onChange={(e) => {
                                updateTag(index, 'type', e.target.value);
                                if (e.target.value !== 'BOOL') {
                                  updateTag(index, 'bit', 0);
                                }
                              }}
                              className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none text-gray-900"
                            >
                              <option value="REAL">REAL (Float)</option>
                              <option value="INT">INT (Integer)</option>
                              <option value="BOOL">BOOL (Boolean)</option>
                              <option value="DINT">DINT (Double)</option>
                            </select>
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">Typ Danych</label>
                          <select
                            value={tag.type}
                            onChange={(e) => updateTag(index, 'type', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none text-gray-900"
                          >
                            <option value="REAL">REAL (Float)</option>
                            <option value="INT">INT (Integer)</option>
                            <option value="BOOL">BOOL (Boolean)</option>
                            <option value="DINT">DINT (Double)</option>
                          </select>
                        </div>
                      )}
                      <div className="md:col-span-1 flex justify-end pt-5">
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          title="Usuń tag"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-4 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-xl transition-all font-bold"
          >
            Anuluj
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-500/25 flex items-center gap-2 border-b-2 border-blue-800 active:border-b-0 active:translate-y-0.5"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Zapisywanie...
              </>
            ) : (
              'Zapisz Sterownik'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PLCModal;
