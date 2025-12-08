import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const LogoMinimal = () => (
  <svg width="80" height="80" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
    <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z" fill="white"/>
    <path d="M12 12L20 22L28 12" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 22V30" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [stage, setStage] = useState(0); 
  const [opacity, setOpacity] = useState(1);
  
  // Estágio 0: Marca Principal
  const titleLetters = "Notify".split("");
  
  // Estágio 1: Subtítulo
  const subtitleLetters = "Notificação".split("");

  useEffect(() => {
    // Sequência de animação otimizada para login mais rápido
    const t1 = setTimeout(() => setStage(1), 2500); 
    const t2 = setTimeout(() => setStage(2), 4500); 
    const t3 = setTimeout(() => setOpacity(0), 6000); 
    const t4 = setTimeout(onFinish, 6800); 

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [onFinish]);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out font-sans overflow-hidden"
      style={{ opacity }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-60"></div>
      
      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* STAGE 0: BRAND REVEAL (Letter by Letter - NOTIFY) */}
        <div 
            className={`flex flex-col items-center transition-all duration-1000 ease-out absolute ${
                stage === 0 
                ? 'opacity-100 scale-100 translate-y-0 blur-none' 
                : 'opacity-0 scale-95 -translate-y-4 blur-sm'
            }`}
        >
            <div className="mb-8 animate-fade-in-up">
                <LogoMinimal />
            </div>
            
            {/* Letra por Letra: Notify */}
            <div className="flex space-x-1">
                {titleLetters.map((letter, index) => (
                    <span 
                        key={index} 
                        className="text-5xl md:text-6xl text-white font-light tracking-wide mix-blend-difference select-none opacity-0 animate-letter-reveal"
                        style={{ animationDelay: `${index * 0.15}s`, animationFillMode: 'forwards' }}
                    >
                        {letter}
                    </span>
                ))}
            </div>
        </div>

        {/* STAGE 1: SUBTITLE (Letter by Letter - Notificação) */}
        <div 
            className={`flex flex-col items-center transition-all duration-1000 ease-out absolute ${
                stage === 1 
                ? 'opacity-100 translate-y-0' 
                : (stage > 1 ? 'opacity-0 -translate-y-4' : 'opacity-0 translate-y-4')
            }`}
        >
            <div className="w-[1px] h-16 bg-gradient-to-b from-transparent via-white to-transparent animate-pulse mb-6"></div>
            
            <div className="flex space-x-0.5">
                {subtitleLetters.map((letter, index) => (
                    <span 
                        key={index} 
                        className="text-xl text-zinc-400 font-light tracking-wider opacity-0 animate-letter-reveal"
                        // Delay começa em 2.5s (início do estágio) + delay por letra
                        style={{ animationDelay: `${2.5 + (index * 0.08)}s`, animationFillMode: 'forwards' }}
                    >
                        {letter}
                    </span>
                ))}
            </div>
        </div>

        {/* STAGE 2: READY STATUS (Pill Design - No Text) */}
        <div 
            className={`flex flex-col items-center transition-all duration-1000 ease-out absolute ${
                stage === 2 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-4'
            }`}
        >
             {/* Container Flex */}
            <div className="flex items-center justify-center px-4 py-3 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                {/* Círculo pulsante branco/verde apenas */}
                <div className="relative flex items-center justify-center w-4 h-4">
                     <div className="absolute w-full h-full bg-green-400 rounded-full opacity-75 animate-ping"></div>
                     <div className="relative w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.8)]"></div>
                </div>
            </div>
        </div>

      </div>

      <style>{`
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes letter-reveal {
            0% { opacity: 0; transform: translateY(10px) scale(0.9); filter: blur(4px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-letter-reveal {
            animation: letter-reveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;