
import React, { useState, useEffect } from 'react';
import { ViewState, NotificationItem, Meeting, Transaction, NotificationStatus } from '../types';
import { Plus, Monitor, Video, CreditCard, ChevronRight, FileText, Send, Clock, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle, ChevronLeft, User, Sparkles, Inbox } from 'lucide-react';

interface DashboardProps {
  notifications: NotificationItem[];
  meetings: Meeting[];
  transactions: Transaction[];
  onNavigate: (view: ViewState) => void;
  user?: any;
}

// --- WIDGETS ---
const MiniClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-full relative overflow-hidden group hover:border-blue-300 transition-all min-h-[160px]">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <Clock size={64} className="text-slate-900" />
            </div>
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Horário Oficial</h3>
                <div className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight font-mono">
                    {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-600 capitalize font-medium">
                    {time.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ notifications, meetings, transactions, onNavigate, user }) => {

  // Cálculos de contagem (DADOS REAIS)
  
  // 1. Notificações Enviadas (Pagas e em transito ou entregues)
  const sentCount = notifications.filter(n => 
      n.status === NotificationStatus.SENT || 
      n.status === NotificationStatus.DELIVERED || 
      n.status === NotificationStatus.READ
  ).length;

  // 2. Recebidas (Assumindo que props.notifications contém as enviadas pelo user, precisamos buscar as recebidas.
  // Nota: A prop 'notifications' aqui vem do App.tsx que carrega as enviadas. 
  // Para exibir o contador de recebidas, idealmente passariamos via props também, 
  // mas vamos assumir que o App.tsx vai passar essa info ou calcular via badgeCounts global.
  // Neste componente, vamos usar uma lógica simplificada ou placeholder se não tivermos os dados completos ainda.
  // Ajuste: Vamos assumir que 'notifications' aqui são APENAS as enviadas.
  
  // 3. Conciliações
  const meetScheduled = meetings.filter(m => m.status === 'scheduled').length;
  
  // 4. Pagamentos Pendentes
  const payPending = transactions.filter(t => t.status === 'Pendente').length;

  const MainCard = ({ 
    title, 
    value, 
    label, 
    icon: Icon, 
    colorClass, 
    view,
    borderColor 
  }: { 
    title: string, 
    value: number, 
    label: string, 
    icon: any, 
    colorClass: string, 
    view: ViewState,
    borderColor: string
  }) => (
    <button 
        onClick={() => onNavigate(view)}
        className={`bg-white rounded-2xl p-6 shadow-sm border ${borderColor} hover:shadow-md transition-all h-full flex flex-col items-start justify-between group w-full text-left`}
    >
        <div className="flex justify-between w-full mb-4">
            <div className={`p-3 rounded-xl ${colorClass}`}>
                <Icon size={24} />
            </div>
            <div className="bg-slate-50 rounded-full px-3 py-1 flex items-center h-8">
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors">Abrir Pasta</span>
                <ChevronRight size={14} className="ml-1 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
        </div>
        
        <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
            <div className="flex items-baseline">
                <span className="text-4xl font-bold text-slate-800 tracking-tighter">{value}</span>
                <span className="ml-2 text-sm text-slate-400 font-medium truncate">{label}</span>
            </div>
        </div>
    </button>
  );

  return (
    <div className="w-full max-w-[1600px] mx-auto animate-fade-in relative overflow-hidden pb-10">
      
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* --- SEÇÃO SUPERIOR: PERFIL + AÇÕES RÁPIDAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        {/* Bloco de Boas-Vindas e Perfil (Esquerda) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Sparkles size={120} className="text-slate-900"/>
             </div>

             <div className="flex items-center gap-5 relative z-10">
                <div className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-md overflow-hidden shrink-0 bg-slate-100">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <User size={32} />
                        </div>
                    )}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Olá, {user?.displayName?.split(' ')[0] || 'Doutor(a)'}!
                    </h2>
                    <p className="text-slate-500 text-sm mb-2">Seu escritório digital está pronto.</p>
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                        <CheckCircle size={12} className="mr-1.5" />
                        Sistema Operacional
                    </div>
                </div>
             </div>
        </div>

        {/* Botões de Ação (Direita) */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-4 h-full">
            <button 
                onClick={() => onNavigate(ViewState.CREATE_NOTIFICATION)}
                className="h-full w-full group relative flex flex-row items-center justify-between p-6 text-white transition-all duration-300 bg-slate-900 rounded-2xl hover:bg-slate-800 focus:outline-none border border-cyan-500/30 shadow-[0_4px_20px_rgba(34,211,238,0.15)] hover:shadow-[0_4px_25px_rgba(34,211,238,0.25)] hover:-translate-y-1"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-full group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        <Plus className="w-6 h-6 text-cyan-400 group-hover:text-white" />
                    </div>
                    <div className="text-left">
                        <span className="block text-lg font-bold tracking-wide text-cyan-50">Criar Notificação</span>
                        <span className="block text-xs text-slate-400">Iniciar novo processo</span>
                    </div>
                </div>
                <ChevronRight className="text-slate-500 group-hover:text-white transition-colors" />
            </button>
        </div>
      </div>

      {/* --- SEÇÃO PRINCIPAL: 4 PILARES --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            
            {/* 1. NOTIFICAÇÕES (ENVIADAS) */}
            <MainCard 
                title="Notificações"
                value={sentCount}
                label="Enviadas e Ativas"
                icon={Monitor}
                colorClass="bg-blue-100 text-blue-600"
                borderColor="border-blue-200"
                view={ViewState.MONITORING}
            />

            {/* 2. RECEBIDAS (NOVO CARD) */}
            <MainCard 
                title="Recebidas"
                value={0} // Este valor deve vir das props se disponível, ou carregado. No MVP assumimos 0 ou logica de App.tsx
                label="Documentos para você"
                icon={Inbox}
                colorClass="bg-orange-100 text-orange-600"
                borderColor="border-orange-200"
                view={ViewState.RECEIVED_NOTIFICATIONS}
            />

            {/* 3. CONCILIAÇÕES */}
            <MainCard 
                title="Conciliações"
                value={meetScheduled}
                label="Agendadas"
                icon={Video}
                colorClass="bg-purple-100 text-purple-600"
                borderColor="border-purple-200"
                view={ViewState.MEETINGS}
            />

            {/* 4. PAGAMENTOS */}
            <MainCard 
                title="Financeiro"
                value={payPending}
                label="Pendentes de Pgto"
                icon={CreditCard}
                colorClass="bg-emerald-100 text-emerald-600"
                borderColor="border-emerald-200"
                view={ViewState.BILLING}
            />
      </div>

      {/* --- WIDGETS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1">
               <MiniClock />
          </div>
          {/* Espaço para mais widgets ou gráficos futuros */}
          <div className="md:col-span-2 bg-slate-50 rounded-2xl border border-slate-200 p-6 flex items-center justify-center text-slate-400 text-sm">
              <span className="flex items-center"><Sparkles size={16} className="mr-2"/> Painel de Inteligência Artificial em breve.</span>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
