import { useState, useEffect } from "react";
import { getMyBalance, createMpPreference } from "../services/api";
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft, CreditCard } from "lucide-react";

export default function BilleteraChofer() {
  const [balance, setBalance] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const data = await getMyBalance();
      setBalance(Number(data.saldo));
      setMovimientos(data.movimientos || []);
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const handlePay = async () => {
    if (balance >= 0) return;
    const deuda = Math.abs(balance);
    
    setPayLoading(true);
    try {
        const res = await createMpPreference(deuda, "Pago de Diaria / Comisión a la Base");
        if (res.init_point) {
            window.location.href = res.init_point;
        } else {
            alert("No se pudo generar el link de pago.");
            setPayLoading(false);
        }
    } catch (err: any) {
        alert("Error al conectar con Mercado Pago: " + (err.response?.data?.detail || err.message));
        setPayLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  const isDebt = balance < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Panel Izquierdo: Estado de Cuenta */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-full">
            <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 mb-6">
                    <Wallet className="text-blue-500" size={24}/> Mi Billetera Virtual
                </h2>
                
                <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center ${isDebt ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <p className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-2">Estado Actual</p>
                    <h1 className={`text-6xl font-black tracking-tighter ${isDebt ? 'text-red-500' : 'text-green-500'}`}>
                        ${Math.abs(balance).toLocaleString('es-AR')}
                    </h1>
                    <p className={`mt-2 font-bold ${isDebt ? 'text-red-400' : 'text-green-400'}`}>
                        {isDebt ? "Saldo Deudor (A Pagar)" : "Saldo a Favor / Al Día"}
                    </p>
                </div>
            </div>

            {isDebt && (
                <div className="mt-8">
                    <button 
                        onClick={handlePay} 
                        disabled={payLoading}
                        className="w-full bg-[#009EE3] hover:bg-[#008ACB] text-white font-bold text-lg py-4 rounded-xl flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,158,227,0.3)] transition-all disabled:opacity-50"
                    >
                        {payLoading ? <Loader2 className="animate-spin" /> : <><CreditCard /> Pagar con Mercado Pago</>}
                    </button>
                    <p className="text-center text-[10px] text-zinc-500 mt-3 font-medium">Serás redirigido de forma segura a Mercado Pago. Tu deuda se liquidará automáticamente al acreditarse el pago.</p>
                </div>
            )}
        </div>

        {/* Panel Derecho: Historial de Movimientos */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 shadow-lg h-full max-h-[500px] flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Últimos Movimientos</h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {movimientos.length === 0 ? (
                    <p className="text-zinc-500 text-sm italic text-center py-6">No tienes movimientos registrados aún.</p>
                ) : movimientos.map((mov) => {
                    const isPositive = Number(mov.monto) >= 0;
                    return (
                        <div key={mov.id} className="bg-zinc-950 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                    {isPositive ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">{mov.descripcion}</p>
                                    <p className="text-zinc-500 text-[10px]">{new Date(mov.created_at).toLocaleString('es-AR')}</p>
                                </div>
                            </div>
                            <div className={`font-black tracking-tight ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? '+' : ''}{Number(mov.monto).toLocaleString('es-AR')}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

    </div>
  );
}
