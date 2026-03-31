import { useState, useEffect } from "react";
import { getActiveTariff, getTariffsHistory, createTariff, getFixedDestinations, createFixedDestination, deleteFixedDestination } from "../services/api";
import { Loader2, Zap, History, DollarSign, Ruler, Printer, MapPin, Plus, Trash2 } from "lucide-react";

export default function TariffManager() {
  const [activeTariff, setActiveTariff] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [destLoading, setDestLoading] = useState(false);

  // Form states
  const [baseFare, setBaseFare] = useState<number>(0);
  const [fractionPrice, setFractionPrice] = useState<number>(0);
  const [fractionKm, setFractionKm] = useState<number>(0.10);

  // Dest Form states
  const [newDest, setNewDest] = useState({ name: '', price: 0, details: '', peaje: false, column_index: 1 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const active = await getActiveTariff();
      if (active) {
          setActiveTariff(active);
          setBaseFare(active.base_fare);
          setFractionPrice(active.per_fraction_price);
          setFractionKm(active.fraction_km);
      }
      const hist = await getTariffsHistory();
      setHistory(hist.filter((t: any) => !t.is_active)); // Hide active from history list
      
      const dests = await getFixedDestinations();
      setDestinations(dests);
    } catch (err) {
      console.error("Error fetching tariffs", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTariff({ base_fare: Number(baseFare), per_fraction_price: Number(fractionPrice), fraction_km: Number(fractionKm) });
      alert("Tarifa actualizada exitosamente. Impactará inmediatamente en las cotizaciones.");
      fetchData();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const handleCreateDest = async (e: React.FormEvent) => {
      e.preventDefault();
      setDestLoading(true);
      try {
          await createFixedDestination(newDest);
          const updated = await getFixedDestinations();
          setDestinations(updated);
          setNewDest({ name: '', price: 0, details: '', peaje: false, column_index: 1 });
      } catch (err: any) {
          alert("Error: " + (err.response?.data?.detail || err.message));
      }
      setDestLoading(false);
  };

  const handleDeleteDest = async (id: string) => {
      if(!confirm("¿Eliminar este destino fijo?")) return;
      try {
          await deleteFixedDestination(id);
          setDestinations(destinations.filter(d => d.id !== id));
      } catch(err: any) {
          alert("Error: " + (err.response?.data?.detail || err.message));
      }
  };

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
        <h2 className="text-2xl font-black mb-2 text-white flex items-center gap-2"><Zap className="text-blue-500"/> Configuración Activa</h2>
        <p className="text-zinc-400 mb-6 text-sm">El motor de IA utilizará estos valores para calcular el costo de los viajes solicitados por WhatsApp.</p>
        
        <form onSubmit={handleCreate} className="flex flex-col gap-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold flex items-center gap-1"><DollarSign size={14}/> Bajada de Bandera (1er KM)</label>
                    <input type="number" step="0.01" required value={baseFare} onChange={e=>setBaseFare(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xl font-black outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold flex items-center gap-1"><Ruler size={14}/> Fracción en KM</label>
                        <input type="number" step="0.01" required value={fractionKm} onChange={e=>setFractionKm(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold flex items-center gap-1"><DollarSign size={14}/> Valor Fracción</label>
                        <input type="number" step="0.01" required value={fractionPrice} onChange={e=>setFractionPrice(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-lg font-bold outline-none focus:border-blue-500 text-blue-400" />
                    </div>
                </div>
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin mb-0 mx-auto" /> : "Guardar Nueva Tarifa"}
            </button>
        </form>
      </div>

      <div className="relative flex flex-col p-6 border-l lg:border-l-zinc-800 lg:border-t-0 border-t border-zinc-800 mt-6 lg:mt-0">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><History size={22} className="text-zinc-500"/> Historial de Tarifas</h3>
              <button onClick={() => window.open('/admin/print-tariff', '_blank')} className="bg-[#15803d] hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all">
                  <Printer size={16} /> Imprimir A4
              </button>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[440px] pr-2">
              {history.length === 0 && !loading && <p className="text-zinc-500 italic text-sm">No hay registro histórico todavía.</p>}
              {history.map(t => (
                  <div key={t.id} className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-xl opacity-70 hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-mono text-zinc-500">{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString()}</span>
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase font-bold border border-zinc-700">Inactiva</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <div><p className="text-[10px] text-zinc-500 uppercase">Base</p><p className="text-white font-bold">${t.base_fare}</p></div>
                          <div><p className="text-[10px] text-zinc-500 uppercase">+KM</p><p className="text-zinc-300">{t.fraction_km}</p></div>
                          <div><p className="text-[10px] text-zinc-500 uppercase">+Valor</p><p className="text-zinc-300 font-bold">${t.per_fraction_price}</p></div>
                      </div>
                  </div>
              ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl mt-4">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <MapPin size={22} className="text-red-500" /> Destinos Fijos (Para Impresión)
        </h3>
        
        <form onSubmit={handleCreateDest} className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8 bg-zinc-950 p-4 rounded-xl border border-zinc-800 shadow-inner">
            <div className="md:col-span-2">
                <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold">Lugar</label>
                <input type="text" required placeholder="Ej: Barranqueras" value={newDest.name} onChange={e=>setNewDest({...newDest, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 text-sm" />
            </div>
            <div>
                <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold">Precio ($)</label>
                <input type="number" required value={newDest.price} onChange={e=>setNewDest({...newDest, price: Number(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 text-sm" />
            </div>
            <div>
                <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold">Detalles (KM)</label>
                <input type="text" placeholder="Ej: 19 km" value={newDest.details} onChange={e=>setNewDest({...newDest, details: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 text-sm" />
            </div>
            <div className="flex flex-col gap-1 items-start justify-center pt-4">
                <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newDest.peaje} onChange={e=>setNewDest({...newDest, peaje: e.target.checked})} className="accent-red-500 w-4 h-4"/> +Peaje
                </label>
            </div>
            <div className="flex items-end gap-2">
                <select value={newDest.column_index} onChange={e=>setNewDest({...newDest, column_index: Number(e.target.value)})} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-white outline-none text-sm cursor-pointer w-[70px]">
                    <option value={1}>Col 1</option>
                    <option value={2}>Col 2</option>
                </select>
                <button type="submit" disabled={destLoading} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg transition-colors flex justify-center items-center gap-1 disabled:opacity-50 h-[38px] text-sm">
                    {destLoading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16}/> Agregar</>}
                </button>
            </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/50">
                <div className="bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 uppercase">Columna 1</div>
                {destinations.filter(d => d.column_index === 1).map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-900">
                        <div className="flex-1">
                            <p className="font-bold text-sm text-white">{d.name} {d.peaje && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-1">+Peaje</span>}</p>
                            <p className="text-xs text-zinc-500">{d.details}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-black text-green-400">${d.price}</span>
                            <button onClick={()=>handleDeleteDest(d.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/50 max-h-min">
                <div className="bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 uppercase">Columna 2</div>
                {destinations.filter(d => d.column_index === 2).map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-900">
                        <div className="flex-1">
                            <p className="font-bold text-sm text-white">{d.name} {d.peaje && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-1">+Peaje</span>}</p>
                            <p className="text-xs text-zinc-500">{d.details}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-black text-green-400">${d.price}</span>
                            <button onClick={()=>handleDeleteDest(d.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>

    </div>
  );
}
