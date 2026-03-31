import { useState, useEffect } from "react";
import { getAllBalances, chargeManualBalance } from "../services/api";
import { Loader2, DollarSign, WalletCards, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function RecaudacionAdmin() {
  const [choferes, setChoferes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [charging, setCharging] = useState(false);

  // Form states
  const [monto, setMonto] = useState<number>(3000);
  const [tipo, setTipo] = useState<string>("cargo_diario");
  const [descripcion, setDescripcion] = useState<string>("Cobro Diaria Base");

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await getAllBalances();
      // Ordenar: primero los deudores
      const sorted = resp.sort((a: any, b: any) => Number(a.saldo) - Number(b.saldo));
      setChoferes(sorted);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCobrarABase = async (choferId: string) => {
      // Cobramos el valor negativo para generar deuda
      if (!confirm(`¿Generar cargo de $${monto} a este chofer?`)) return;
      
      setCharging(true);
      try {
          await chargeManualBalance({
              chofer_id: choferId,
              monto: -monto, // Negativo porque le restamos saldo (aumenta deuda)
              tipo,
              descripcion
          });
          fetchData();
      } catch (err: any) {
          alert("Error: " + (err.response?.data?.detail || err.message));
      }
      setCharging(false);
  };

  const handlePagoEfectivo = async (choferId: string, montoRendido: number) => {
      // El chofer viene y paga efectivo en la base. Le sumamos saldo positivo
      if (!confirm(`¿Marcar pago en EFECTIVO por $${Math.abs(montoRendido)}?`)) return;
      
      setCharging(true);
      try {
          await chargeManualBalance({
              chofer_id: choferId,
              monto: Math.abs(montoRendido), // Positivo porque cancela deuda
              tipo: "pago_efectivo",
              descripcion: "Abono en Efectivo en Base"
          });
          fetchData();
      } catch (err: any) {
          alert("Error: " + (err.response?.data?.detail || err.message));
      }
      setCharging(false);
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div>
              <h2 className="text-2xl font-black mb-2 text-white flex items-center gap-2"><WalletCards className="text-blue-500"/> Recaudación & Finanzas</h2>
              <p className="text-zinc-400 text-sm">Gestiona la deuda de los móviles. Los choferes con deuda verán un link de Mercado Pago en su app.</p>
          </div>
          
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-wrap md:flex-nowrap items-end gap-3 flex-1 md:max-w-xl">
              <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold">Concepto Predet.</label>
                  <input type="text" value={descripcion} onChange={(e)=>setDescripcion(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="w-[100px]">
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold">Monto ($)</label>
                  <input type="number" value={monto} onChange={(e)=>setMonto(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-red-400 font-bold outline-none" />
              </div>
              <div className="w-[120px]">
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-bold">Tipo</label>
                  <select value={tipo} onChange={(e)=>setTipo(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-white outline-none">
                      <option value="cargo_diario">Diaria</option>
                      <option value="cargo_viaje">Comisión</option>
                      <option value="cargo_manual">Manual</option>
                  </select>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
          {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : choferes.length === 0 ? (
              <p className="text-center text-zinc-500 italic">No hay choferes en el sistema.</p>
          ) : choferes.map(c => {
              const saldo = Number(c.saldo);
              const isDebt = saldo < 0;
              
              return (
                  <div key={c.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      <div className="flex flex-col">
                          <span className="font-bold text-lg text-white">{c.nombre}</span>
                          <span className="text-xs text-zinc-500">{c.vehiculo} - {c.patente}</span>
                      </div>
                      
                      <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${isDebt ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                          {isDebt ? <ShieldAlert size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-green-500" />}
                          <div>
                              <p className="text-[10px] uppercase font-bold text-zinc-400">Saldo Actual</p>
                              <p className={`font-black text-xl tracking-tighter ${isDebt ? 'text-red-500' : 'text-green-500'}`}>
                                  {isDebt ? '-' : ''}${Math.abs(saldo).toLocaleString('es-AR')}
                              </p>
                          </div>
                      </div>

                      <div className="flex items-center gap-2">
                          <button 
                              onClick={() => handleCobrarABase(c.id)}
                              disabled={charging}
                              className="bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-all"
                          >
                              <DollarSign size={16} /> Cargar Deuda
                          </button>

                          {isDebt && (
                              <button 
                                  onClick={() => handlePagoEfectivo(c.id, saldo)}
                                  disabled={charging}
                                  className="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-all"
                              >
                                  Asentar Efectivo
                              </button>
                          )}
                      </div>
                  </div>
              )
          })}
      </div>

    </div>
  );
}
