
import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const LogoMinimal = () => (
  <svg width="100" height="100" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
    <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z" fill="white"/>
    <path d="M12 12L20 22L28 12" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 22V30" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [stage, setStage] = useState(0); 
  const [showFlash, setShowFlash] = useState(false);
  const [loadingText, setLoadingText] = useState('Inicializando núcleo...');
  const [progress, setProgress] = useState(0);
  
  // Estágio 0: Marca Principal
  const titleLetters = "Notify".split("");
  
  // Estágio 1: Subtítulo
  const subtitleLetters = "Inteligência Jurídica".split("");

  useEffect(() => {
    // Simulação da Barra de Progresso (aprox 8s para chegar a 100%)
    const progressInterval = setInterval(() => {
        setProgress(prev => {
            if (prev >= 100) {
                clearInterval(progressInterval);
                return 100;
            }
            // Incremento calculado para durar o tempo total
            return prev + (100 / 80); 
        });
    }, 100);

    // Sequência de Textos de Carregamento
    setTimeout(() => setLoadingText('Carregando modelos de IA...'), 2000);
    setTimeout(() => setLoadingText('Verificando protocolos de segurança...'), 4500);
    setTimeout(() => setLoadingText('Sincronizando banco de dados...'), 6000);

    // Sequência de Estágios Visuais
    // Estágio 1: Aparece o subtítulo
    const t1 = setTimeout(() => setStage(1), 2500); 
    
    // Estágio 2: Sistema Pronto
    const t2 = setTimeout(() => {
        setStage(2);
        setLoadingText('Sistema Pronto');
    }, 7000); 
    
    // Estágio 3: Flash de luz final
    const t3 = setTimeout(() => setShowFlash(true), 7800); 
    
    // Finaliza (Total: 8.5 segundos)
    const t4 = setTimeout(onFinish, 8500); 

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      clearInterval(progressInterval);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-sans overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80"></div>
      
      {/* FLASH EFFECT (Luz Final) */}
      <div 
        className={`fixed inset-0 bg-white z-[10000] pointer-events-none transition-all duration-700 ease-out ${
            showFlash ? 'opacity-100 scale-150 blur-xl' : 'opacity-0 scale-100'
        }`}
      ></div>

      {/* Main Container - Usando Grid para sobreposição centralizada perfeita */}
      <div className={`relative z-10 w-full h-full grid place-items-center transition-opacity duration-500 ${showFlash ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* STAGE 0: BRAND REVEAL */}
        <div 
            className={`flex flex-col items-center transition-all duration-1000 ease-out col-start-1 row-start-1 ${
                stage === 0 
                ? 'opacity-100 scale-100 translate-y-0 blur-none' 
                : 'opacity-0 scale-95 -translate-y-8 blur-sm'
            }`}
        >
            <div className="mb-10 animate-fade-in-up">
                <LogoMinimal />
            </div>
            
            <div className="flex space-x-2">
                {titleLetters.map((letter, index) => (
                    <span 
                        key={index} 
                        className="text-6xl md:text-7xl text-white font-bold tracking-tight mix-blend-difference select-none opacity-0 animate-letter-reveal"
                        style={{ animationDelay: `${index * 0.15}s`, animationFillMode: 'forwards' }}
                    >
                        {letter}
                    </span>
                ))}
            </div>
        </div>

        {/* STAGE 1: SUBTITLE & LOADING */}
        <div 
            className={`flex flex-col items-center transition-all duration-1000 ease-out col-start-1 row-start-1 w-full max-w-md ${
                stage === 1 
                ? 'opacity-100 translate-y-0' 
                : (stage > 1 ? 'opacity-0 -translate-y-8' : 'opacity-0 translate-y-8')
            }`}
        >
            <div className="flex space-x-1 mb-12">
                {subtitleLetters.map((letter, index) => (
                    <span 
                        key={index} 
                        className="text-lg md:text-xl text-zinc-400 font-light tracking-[0.2em] uppercase opacity-0 animate-letter-reveal"
                        style={{ animationDelay: `${0.5 + (index * 0.05)}s`, animationFillMode: 'forwards' }}
                    >
                        {letter}
                    </span>
                ))}
            </div>

            {/* Loading Bar & Text */}
            <div className="w-64 flex flex-col items-center gap-3">
                <div className="w-full h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-white transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase animate-pulse">
                    {loadingText}
                </p>
            </div>
        </div>

        {/* STAGE 2: READY STATUS */}
        <div 
            className={`flex flex-col items-center transition-all duration-1000 ease-out col-start-1 row-start-1 ${
                stage === 2 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
        >
            <div className="flex items-center justify-center px-8 py-5 border border-white/20 rounded-full bg-white/5 backdrop-blur-xl shadow-[0_0_50px_rgba(255,255,255,0.15)] transform scale-110">
                <div className="relative flex items-center justify-center w-6 h-6 mr-4">
                     <div className="absolute w-full h-full bg-emerald-400 rounded-full opacity-75 animate-ping"></div>
                     <div className="relative w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,1)]"></div>
                </div>
                <span className="text-white font-bold text-base tracking-[0.2em] uppercase">Sistema Pronto</span>
            </div>
        </div>

      </div>

      <style>{`
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(30px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes letter-reveal {
            0% { opacity: 0; transform: translateY(15px) scale(0.9); filter: blur(8px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-letter-reveal {
            animation: letter-reveal 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
    