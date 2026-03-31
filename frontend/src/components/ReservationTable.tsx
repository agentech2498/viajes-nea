import { useState, useEffect } from "react";
import { getReservations, updateReservationStatus } from "../services/api";
import { Calendar, CheckCircle2, XCircle, Clock, Loader2, PlayCircle } from "lucide-react";

export default function ReservationTable() {
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("todas");

    const fetchRes = async () => {
        setLoading(true);
        try {
            const data = await getReservations(filter !== "todas" ? filter : undefined);
            setReservations(data);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRes();
    }, [filter]);

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            await updateReservationStatus(id, newStatus);
            fetchRes();
        } catch (error) {
            alert("Error al actualizar la reserva.");
        }
    };

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pendiente': return <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><Clock size={10}/> Pendiente</span>;
            case 'confirmada': return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><CheckCircle2 size={10}/> Confirmada</span>;
            case 'asignada': return <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><PlayCircle size={10}/> En Curso</span>;
            case 'cancelada': return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><XCircle size={10}/> Cancelada</span>;
            default: return <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">{status}</span>;
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-2"><Calendar className="text-blue-500"/> Reservas Inteligentes</h2>
                  <p className="text-zinc-500 text-sm">Viajes agendados directamente por los clientes desde WhatsApp.</p>
               </div>
               <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 overflow-hidden">
                   {['todas', 'pendiente', 'confirmada', 'cancelada'].map(f => (
                       <button
                         key={f}
                         onClick={() => setFilter(f)}
                         className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filter === f ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'}`}
                       >
                           {f}
                       </button>
                   ))}
               </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                        <tr>
                            <th className="px-6 py-4">Fecha / Hora</th>
                            <th className="px-6 py-4">Pasajero</th>
                            <th className="px-6 py-4">Recorrido</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {loading ? (
                            <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="animate-spin text-blue-500 mx-auto" size={24}/></td></tr>
                        ) : reservations.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center text-zinc-500 italic">No hay reservas en esta categoría.</td></tr>
                        ) : (
                            reservations.map(r => (
                                <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <p className="font-bold text-white">{new Date(r.fecha_viaje).toLocaleDateString()}</p>
                                        <p className="text-blue-400 font-mono text-xs font-bold">{r.hora_viaje.substring(0,5)} hs</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-white mb-0.5">{r.nombre_cliente}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono">{r.telefono}</p>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate">
                                        <div className="flex gap-2 text-xs">
                                            <span className="text-zinc-500 font-bold w-4">A:</span><span className="text-zinc-300 truncate" title={r.origen}>{r.origen}</span>
                                        </div>
                                        <div className="flex gap-2 text-xs mt-1">
                                            <span className="text-zinc-500 font-bold w-4">B:</span><span className="text-zinc-300 truncate" title={r.destino}>{r.destino}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(r.estado)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {r.estado === 'pendiente' && (
                                            <div className="flex gap-2 justify-center">
                                                <button onClick={() => handleStatusChange(r.id, 'confirmada')} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors border border-emerald-500/20 hover:border-emerald-500">Confirmar</button>
                                                <button onClick={() => handleStatusChange(r.id, 'cancelada')} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors border border-red-500/20 hover:border-red-500">Cancelar</button>
                                            </div>
                                        )}
                                        {r.estado === 'confirmada' && (
                                            <button onClick={() => handleStatusChange(r.id, 'asignada')} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors shadow-lg shadow-blue-500/20">Despachar</button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
