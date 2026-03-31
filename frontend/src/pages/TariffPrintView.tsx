import { useEffect, useState } from "react";
import { getActiveTariff, getFixedDestinations } from "../services/api";
import { Loader2 } from "lucide-react";

export default function TariffPrintView() {
    const [tariff, setTariff] = useState<any>(null);
    const [destinations, setDestinations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Automatically open print dialog once loaded
        const fetchTariff = async () => {
            try {
                const data = await getActiveTariff();
                const dests = await getFixedDestinations();
                setTariff(data);
                setDestinations(dests);
                setLoading(false);
                setTimeout(() => window.print(), 800);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        fetchTariff();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin text-black" size={48} /></div>;
    if (!tariff) return <div className="text-center p-10 text-black">No hay tarifa activa.</div>;

    const baseFare = tariff.base_fare || 2500;
    const fractionPrice = tariff.per_fraction_price || 175;
    // We assume fraction_km is 0.1 for this visual format. 
    // The user's image shows fractions from .1 to .9

    // The user's image shows up to 30.9 KM in standard columns, but omits some to fit. 
    // We will generate 30 rows per column.
    const rowsPerCol = 30; // 3.0 KM per column
    
    // Page 1: 6 columns (1.0 to 18.9)
    // Page 2: 6 columns (19.0 to 36.9)
    const renderColumn = (startKm: number) => {
        const rows = [];
        for (let i = 0; i < rowsPerCol; i++) {
            const currentKm = startKm + (i * 0.1);
            // Calculate price based on base fare for first KM, then fractions.
            // In the real engine, 1st KM = base_fare. (1.0 = base_fare).
            // 1.1 = base_fare + 1 * fractionPrice
            let totalFractions = Math.round((currentKm - 1.0) * 10);
            if (totalFractions < 0) totalFractions = 0;
            const price = baseFare + (totalFractions * fractionPrice);
            
            const isInteger = Math.abs(currentKm - Math.round(currentKm)) < 0.01;
            const formattedKm = currentKm.toFixed(1).replace('.', ',');
            const formattedPrice = price.toLocaleString('es-AR');

            rows.push(
                <div key={i} className={`flex w-full ${isInteger ? 'bg-black text-white' : 'bg-white text-black'}`}>
                    <div className={`w-[45%] text-center font-bold font-sans text-sm md:text-base border border-black ${isInteger ? 'bg-black text-white' : 'bg-[#15803d] text-white'}`}>
                        {formattedKm}
                    </div>
                    <div className={`w-[55%] text-center font-black font-sans text-sm md:text-base border border-black ${isInteger ? 'bg-black text-white' : 'bg-white'}`}>
                        {formattedPrice}
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col border-[3px] border-black w-full shadow-sm bg-white break-inside-avoid">
                {rows}
            </div>
        );
    };

    const fixedDestinationsCol1 = destinations.filter(d => d.column_index === 1);
    const fixedDestinationsCol2 = destinations.filter(d => d.column_index === 2);

    return (
        <div className="bg-white min-h-screen font-sans text-black print:bg-white print:m-0 print:p-0 p-4 md:p-8">
            
            {/* Global Print Styles */}
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: white !important; }
                    .print-break { page-break-after: always; }
                }
            `}</style>

            {/* PAGE 1 */}
            <div className="max-w-[1200px] mx-auto print:max-w-none print:w-full print-break">
                {/* Header Logo Placeholder */}
                <div className="flex justify-center items-center mb-6 h-28">
                    <div className="flex flex-col items-center">
                       {/* SVG Placeholder simulating El Rayo logo */}
                       <h1 className="text-5xl font-black italic tracking-tighter" style={{ color: '#000', textShadow: '2px 2px 0px #15803d' }}>
                          REMISES <span className="text-[#15803d]">EL RAYO</span>
                       </h1>
                       <div className="flex items-center gap-2 mt-2">
                          <span className="bg-red-600 text-white px-2 py-0.5 text-xs font-bold italic rounded-sm">RÁPIDOS Y SEGUROS</span>
                       </div>
                    </div>
                </div>

                {/* Tariff Grid 6 Columns */}
                <div className="grid grid-cols-6 gap-1.5 md:gap-2 mb-6">
                    {renderColumn(1.0)}
                    {renderColumn(4.0)}
                    {renderColumn(7.0)}
                    {renderColumn(10.0)}
                    {renderColumn(13.0)}
                    {renderColumn(16.0)}
                </div>

                {/* Info Bar */}
                <div className="flex justify-between items-center text-[#15803d] font-bold text-lg md:text-xl px-12 uppercase mb-4 tracking-tight">
                    <span>KM En Ruta $1050</span>
                    <span>Tarifa Mínima ${baseFare.toLocaleString('es-AR')}</span>
                    <span>Espera 10 Min. ${baseFare.toLocaleString('es-AR')}</span>
                    <span>Baúl ${baseFare.toLocaleString('es-AR')}</span>
                </div>

                {/* Fixed Destinations and Socials */}
                <div className="grid grid-cols-3 gap-6">
                    {/* Fixed Destinations Col 1 */}
                    <div className="col-span-1 border-2 border-black flex flex-col bg-white">
                        {fixedDestinationsCol1.map((dest, i) => (
                            <div key={i} className="flex justify-between text-[11px] md:text-sm font-bold border-b border-black last:border-0 px-2 py-0.5">
                                <span className="w-1/2">{dest.name}</span>
                                <span className="w-1/4 text-center">{dest.peaje ? '+Peaje' : ''}</span>
                                <span className="w-1/4 text-right">${dest.price.toLocaleString('es-AR')}</span>
                            </div>
                        ))}
                    </div>

                    {/* Fixed Destinations Col 2 */}
                    <div className="col-span-1 border-2 border-black flex flex-col bg-white h-full max-h-min">
                        {fixedDestinationsCol2.map((dest, i) => (
                            <div key={i} className="flex justify-between text-[11px] md:text-sm font-bold border-b border-black last:border-0 px-2 py-0.5">
                                <span className="w-1/2">{dest.name}</span>
                                <span className="w-1/4 text-center">{dest.details}</span>
                                <span className="w-1/4 text-right">${dest.price.toLocaleString('es-AR')}</span>
                            </div>
                        ))}
                    </div>

                    {/* Socials */}
                    <div className="col-span-1 flex flex-col justify-center gap-6 pl-4 border-2 border-transparent">
                        <div className="flex items-center gap-3 text-red-600 font-bold text-xl">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="IG" className="w-8 h-8 filter sepia-0 hue-rotate-0" />
                            Remises El Rayo
                        </div>
                        <div className="flex items-center gap-3 text-[#15803d] font-bold text-lg">
                            <img src="https://cdn-icons-png.flaticon.com/512/732/732200.png" alt="Email" className="w-8 h-8" />
                            Remiseselrayocorrientes@Hotmail.com
                        </div>
                        <div className="flex items-center gap-3 text-blue-700 font-bold text-xl">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="FB" className="w-8 h-8" />
                            Remises El Rayo
                        </div>
                    </div>
                </div>
            </div>

            {/* PAGE 2 */}
            <div className="max-w-[1200px] mx-auto print:max-w-none print:w-full mt-24 print:mt-0">
                <div className="grid grid-cols-6 gap-1.5 md:gap-2 mb-6">
                    {renderColumn(19.0)}
                    {renderColumn(22.0)}
                    {renderColumn(25.0)}
                    {renderColumn(28.0)}
                    {renderColumn(31.0)}
                    {renderColumn(34.0)}
                </div>
            </div>

        </div>
    );
}
