import React, { useState, useEffect } from "react";
import { Sun, Cloud, CloudRain, CloudLightning, CloudDrizzle, CloudSnow, Loader2, MapPin } from "lucide-react";

// Código WMO de la Organización Meteorológica Mundial a Icono y Texto
const getWeatherInfo = (code: number) => {
    switch (true) {
        case (code === 0):
            return { text: "Cielo Despejado", icon: Sun, color: "text-amber-400", bg: "from-amber-500/10 to-transparent", border: "border-amber-500/20" };
        case (code === 1 || code === 2 || code === 3):
            return { text: "Algo Nublado", icon: Cloud, color: "text-gray-300", bg: "from-gray-500/10 to-transparent", border: "border-gray-500/20" };
        case (code >= 45 && code <= 48):
            return { text: "Neblina/Niebla", icon: Cloud, color: "text-zinc-400", bg: "from-zinc-500/10 to-transparent", border: "border-zinc-500/20" };
        case (code >= 51 && code <= 57):
            return { text: "Llovizna Leve", icon: CloudDrizzle, color: "text-blue-300", bg: "from-blue-500/10 to-transparent", border: "border-blue-500/20" };
        case (code >= 61 && code <= 67):
            return { text: "Lluvia", icon: CloudRain, color: "text-blue-500", bg: "from-blue-600/10 to-transparent", border: "border-blue-600/20" };
        case (code >= 71 && code <= 77):
            return { text: "Nieve", icon: CloudSnow, color: "text-white", bg: "from-white/10 to-transparent", border: "border-white/20" };
        case (code >= 80 && code <= 82):
            return { text: "Chubascos Fuertes", icon: CloudRain, color: "text-blue-600", bg: "from-blue-700/10 to-transparent", border: "border-blue-700/20" };
        case (code >= 95 && code <= 99):
            return { text: "Tormenta Eléctrica", icon: CloudLightning, color: "text-purple-400", bg: "from-purple-500/10 to-transparent", border: "border-purple-500/20" };
        default:
            return { text: "Consultando...", icon: Cloud, color: "text-zinc-400", bg: "from-zinc-900/40 to-transparent", border: "border-white/5" };
    }
};

export default function WeatherWidget() {
    const [weather, setWeather] = useState<{ temp: number, code: number, isDay: boolean } | null>(null);
    const [loading, setLoading] = useState(true);
    const [city, setCity] = useState("Corrientes, NEA"); // Respaldo estético

    useEffect(() => {
        let isMounted = true;

        const fetchWeather = async (lat: number, lng: number, cityName = "Corrientes, NEA") => {
            try {
                // Open-Meteo Current Weather
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`);
                const data = await res.json();
                
                if (isMounted && data.current_weather) {
                    setWeather({
                        temp: Math.round(data.current_weather.temperature),
                        code: data.current_weather.weathercode,
                        isDay: data.current_weather.is_day === 1
                    });
                    setCity(cityName);
                }
            } catch (err) {
                console.error("Error obteniendo el clima", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        // Intentar obtener las coordenadas reales (Con Timeout rápido)
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Ubicación Actual"),
                (err) => {
                    console.warn("GPS denegado para clima, usando ubicación base (Corrientes, AR)");
                    // Fallback to Corrientes, Argentina Coordinates
                    fetchWeather(-27.4692, -58.8306);
                },
                { timeout: 5000, maximumAge: 600000 }
            );
        } else {
            fetchWeather(-27.4692, -58.8306);
        }

        return () => { isMounted = false; };
    }, []);

    if (loading) {
        return (
            <div className="flex bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-2xl px-4 py-2 mt-4 max-w-fit items-center gap-3 animate-pulse shadow-xl">
                <Loader2 size={16} className="text-zinc-500 animate-spin" />
                <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Rastreo Satelital...</span>
            </div>
        );
    }

    if (!weather) return null;

    const weatherInfo = getWeatherInfo(weather.code);
    const Icon = weatherInfo.icon;

    return (
        <div className={`relative overflow-hidden flex bg-gradient-to-r ${weatherInfo.bg} backdrop-blur-md border ${weatherInfo.border} rounded-2xl p-0.5 mt-4 max-w-fit items-center shadow-2xl transition-all duration-700 hover:scale-[1.02] group`}>
            {/* Destello Premium Suave */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="flex bg-zinc-950/40 rounded-[14px] px-4 py-2 items-center gap-4 z-10 w-full h-full">
                
                {/* ICONO Y TEMPERATURA */}
                <div className="flex items-center gap-2">
                    <Icon size={24} className={`${weatherInfo.color} drop-shadow-[0_0_8px_currentColor] animate-in zoom-in-50 duration-500 ${weatherInfo.text === "Cielo Despejado" ? "animate-spin-slow" : ""}`} />
                    <span className="text-2xl font-black text-white tracking-tighter drop-shadow-md">
                        {weather.temp}°
                    </span>
                </div>

                <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

                {/* TEXTOS (ESTADO Y UBICACIÓN) */}
                <div className="flex flex-col">
                    <span className={`text-xs font-black uppercase tracking-widest drop-shadow-sm ${weatherInfo.color}`}>
                        {weatherInfo.text}
                    </span>
                    <span className="text-[10px] items-center text-zinc-400 font-bold flex gap-1 uppercase">
                        <MapPin size={10} className="text-red-400" /> {city}
                    </span>
                </div>

            </div>
        </div>
    );
}
