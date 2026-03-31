import { useState, useEffect } from "react";
import { getMyBalance, createMpPreference } from "../services/api";
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, PlusCircle, CheckCircle2 } from "lucide-react";

export default function BilleteraChofer() {
  const [balance, setBalance] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");

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

  const handlePay = async (amountToPay?: number) => {
    const finalAmount = amountToPay || Number(customAmount) || (balance < 0 ? Math.abs(balance) : 0);
    
    if (finalAmount <= 0) {
        alert("Por favor, ingresa un monto válido para recargar.");
        return;
    }
    
    setPayLoading(true);
    try {
        const descripcion = balance < 0 && finalAmount >= Math.abs(balance) 
            ? "Liquidación de Deuda - Viajes NEA" 
            : "Recarga de Saldo - Viajes NEA";
            
        const res = await createMpPreference(finalAmount, descripcion);
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-green-500" size={48} />
        <p className="text-zinc-500 font-bold animate-pulse tracking-widest text-xs uppercase">Sincronizando Billetera...</p>
    </div>
  );

  const isDebt = balance < 0;
  const absBalance = Math.abs(balance);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* COLUMNA IZQUIERDA: SALDO Y ACCIONES (8 COLS) */}
        <div className="lg:col-span-7 space-y-6">
            
            {/* CARD DE SALDO PRINCIPAL */}
            <div className={`relative overflow-hidden p-8 rounded-[2rem] border backdrop-blur-md transition-all duration-500 ${isDebt ? 'bg-red-500/5 border-red-500/20 shadow-[0_20px_40px_-15px_rgba(239,68,68,0.1)]' : 'bg-green-500/5 border-green-500/20 shadow-[0_20px_40px_-15px_rgba(34,197,94,0.1)]'}`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-[2rem] pointer-events-none" />
                
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Estado de Cuenta</h2>
                        <p className={`text-xs font-bold ${isDebt ? 'text-red-400' : 'text-green-400'}`}>
                            {isDebt ? "⚠️ REQUERIDO: CANCELAR DEUDA" : "✓ AL DÍA: SALDO A FAVOR"}
                        </p>
                    </div>
                    <Wallet className={isDebt ? 'text-red-500/50' : 'text-green-500/50'} size={32} />
                </div>

                <div className="flex flex-col items-center py-4">
                    <span className="text-zinc-500 text-2xl font-light mb-1">$</span>
                    <h1 className={`text-7xl font-black tracking-tighter ${isDebt ? 'text-red-500' : 'text-green-400'}`}>
                        {absBalance.toLocaleString('es-AR')}
                    </h1>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                        <CheckCircle2 size={14} className="text-green-500/60" />
                        <span>Sincronizado con Mercado Pago</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN DE RECARGA (SIEMPRE VISIBLE) */}
            <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-[2rem] p-8 shadow-2xl">
                <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 tracking-tight">
                    <PlusCircle size={20} className="text-blue-500" /> Opciones de Pago y Recarga
                </h3>

                <div className="space-y-6">
                    {/* Botones rápidos */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[1000, 2000, 5000, 10000].map((m) => (
                            <button
                                key={m}
                                onClick={() => handlePay(m)}
                                disabled={payLoading}
                                className="bg-zinc-800/50 hover:bg-zinc-700/80 border border-white/5 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                            >
                                ${m.toLocaleString()}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-zinc-500 font-bold">$</span>
                        </div>
                        <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Otro monto..."
                            className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl py-4 pl-8 pr-4 text-white font-bold placeholder-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <button 
                        onClick={() => handlePay()} 
                        disabled={payLoading}
                        className={`w-full relative group py-5 rounded-2xl font-black text-lg flex justify-center items-center gap-3 transition-all active:scale-95 shadow-xl disabled:opacity-50 overflow-hidden ${isDebt && !customAmount ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20' : 'bg-[#009EE3] hover:bg-[#008ACB] text-white shadow-blue-500/20'}`}
                    >
                        {payLoading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                <CreditCard /> 
                                {(isDebt && !customAmount) ? "LIQUIDAR MI DEUDA" : "RECARGAR MI BILLETERA"}
                            </>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] group-hover:animate-[shine_2s_infinite]" />
                    </button>
                    
                    <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                        <img src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo-1.png" alt="Mercado Pago" className="h-4 brightness-0 invert opacity-50" />
                        <p className="text-[10px] text-zinc-500 font-medium font-mono uppercase tracking-widest">Pago 100% Seguro y Encriptado</p>
                    </div>
                </div>
            </div>
        </div>

        {/* COLUMNA DERECHA: MOVIMIENTOS (5 COLS) */}
        <div className="lg:col-span-5">
            <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-[2rem] p-8 shadow-xl h-full flex flex-col">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <h3 className="text-lg font-black text-white tracking-tight uppercase tracking-widest">Movimientos</h3>
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black px-3 py-1 rounded-full">{movimientos.length} REG.</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {movimientos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                            <ArrowDownLeft size={48} className="mb-4 text-zinc-600" />
                            <p className="text-sm font-bold tracking-widest uppercase">Sin movimientos registrados</p>
                        </div>
                    ) : movimientos.map((mov) => {
                        const isPositive = Number(mov.monto) >= 0;
                        return (
                            <div key={mov.id} className="group relative bg-zinc-950/30 border border-white/5 p-5 rounded-[1.5rem] flex items-center justify-between hover:bg-zinc-900/50 transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {isPositive ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-sm tracking-tight">{mov.descripcion}</p>
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">
                                            {new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className={`font-black text-lg tracking-tighter ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPositive ? '+' : ''}{Number(mov.monto).toLocaleString('es-AR')}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

    </div>
  );
}
