import React, { useState, useEffect } from 'react';
import { ViewState, NotificationItem, Meeting, Transaction, NotificationStatus } from '../types';
import { Plus, Monitor, Video, CreditCard, ChevronRight, FileText, Send, Clock, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle, ChevronLeft, User, Sparkles } from 'lucide-react';

interface DashboardProps {
  notifications: NotificationItem[];
  meetings: Meeting[];
  transactions: Transaction[];
  onNavigate: (view: ViewState) => void;
  user?: any;
}

// --- WIDGET: RELÓGIO ---
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
                    <span className="text-sm text-slate-400 font-normal ml-1">
                         {time.toLocaleTimeString('pt-BR', { second: '2-digit' })}
                    </span>
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

// --- WIDGET: CALENDÁRIO ---
const MiniCalendar = ({ meetings }: { meetings: Meeting[] }) => {
    const [currDate, setCurrDate] = useState(new Date());
    
    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = currDate.getFullYear();
    const month = currDate.getMonth();
    const today = new Date();

    const totalDays = daysInMonth(year, month);
    const startDay = startDayOfMonth(year, month);
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const blanksArray = Array.from({ length: startDay }, (_, i) => i);

    const hasMeeting = (day: number) => {
        return meetings.some(m => {
            if (m.status === 'canceled') return false;
            const [mYear, mMonth, mDay] = m.date.split('-').map(Number);
            return mYear === year && (mMonth - 1) === month && mDay === day;
        });
    };

    const changeMonth = (offset: number) => {
        setCurrDate(new Date(year, month + offset, 1));
    };

    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 h-full flex flex-col group hover:border-purple-300 transition-all min-h-[160px]">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agenda</h3>
                <div className="flex gap-1 items-center">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={14} /></button>
                    <span className="text-xs font-bold text-slate-800 w-20 text-center capitalize truncate">
                        {currDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={14} /></button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['D','S','T','Q','Q','S','S'].map(d => (
                    <span key={d} className="text-[9px] font-bold text-slate-400">{d}</span>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-0.5 text-center flex-1 content-start">
                {blanksArray.map(b => <div key={`blank-${b}`} />)}
                {daysArray.map(day => {
                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                    const meetingDay = hasMeeting(day);
                    
                    return (
                        <div key={day} className="flex flex-col items-center justify-center relative h-6 w-full">
                            <span 
                                className={`
                                    text-[10px] font-medium h-5 w-5 flex items-center justify-center rounded-full transition-colors
                                    ${isToday ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}
                                    ${meetingDay && !isToday ? 'font-bold text-purple-600 bg-purple-50' : ''}
                                `}
                            >
                                {day}
                            </span>
                            {meetingDay && (
                                <span className="absolute bottom-0 h-0.5 w-0.5 bg-purple-500 rounded-full"></span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ notifications, meetings, transactions, onNavigate, user }) => {

  // Cálculos de contagem
  const notifCreated = notifications.filter(n => n.status === NotificationStatus.DRAFT).length;
  const notifDelivered = notifications.filter(n => [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(n.status)).length;
  const notifPending = notifications.filter(n => n.status === NotificationStatus.PENDING_PAYMENT).length;

  const meetScheduled = meetings.filter(m => m.status === 'scheduled').length;
  const meetDone = meetings.filter(m => m.status === 'completed').length;
  const meetCanceled = meetings.filter(m => m.status === 'canceled').length;

  const payConfirmed = transactions.filter(t => t.status === 'Pago').length;
  const payPending = transactions.filter(t => t.status === 'Pendente').length;
  const payRefunded = transactions.filter(t => t.status === 'Reembolsado').length;

  const CardSection = ({ 
    title, 
    icon: Icon, 
    colorClass, 
    items 
  }: { 
    title: string, 
    icon: any, 
    colorClass: string, 
    items: { label: string, count: number, view: ViewState, subIcon: any }[] 
  }) => (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="flex items-center gap-3 mb-5">
            <div className={`p-2.5 rounded-xl ${colorClass}`}>
                <Icon size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </div>
        
        <div className="space-y-2 flex-1">
            {items.map((item, idx) => (
                <button 
                    key={idx}
                    onClick={() => onNavigate(item.view)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-300 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                            <item.subIcon size={16} />
                        </div>
                        <span className="font-medium text-slate-700 text-xs">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100 text-xs min-w-[24px]">
                            {item.count}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    </div>
  );

  return (
    <div className="w-full max-w-[1600px] mx-auto animate-fade-in relative overflow-hidden pb-10">
      
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* --- SEÇÃO SUPERIOR: PERFIL + AÇÕES RÁPIDAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        
        {/* Bloco de Boas-Vindas e Perfil (Esquerda) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden">
             {/* Efeito de fundo sutil */}
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
                    <p className="text-slate-500 text-sm mb-2">Painel de Controle</p>
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                        <CheckCircle size={12} className="mr-1.5" />
                        Sistema Operacional
                    </div>
                </div>
             </div>
        </div>

        {/* Botões de Ação (Direita) - MESMO TAMANHO */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-4 h-full">
            <button 
                onClick={() => onNavigate(ViewState.CREATE_NOTIFICATION)}
                className="h-full w-full group relative flex flex-col items-center justify-center p-4 text-white transition-all duration-300 bg-slate-900 rounded-2xl hover:bg-slate-800 focus:outline-none border border-cyan-500/30 shadow-[0_4px_20px_rgba(34,211,238,0.15)] hover:shadow-[0_4px_25px_rgba(34,211,238,0.25)] hover:-translate-y-1"
            >
                <div className="p-3 bg-white/10 rounded-full mb-3 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                     <Plus className="w-6 h-6 text-cyan-400 group-hover:text-white" />
                </div>
                <span className="text-sm font-bold tracking-wide text-cyan-50">NOVA NOTIFICAÇÃO</span>
            </button>

            <button 
                onClick={() => window.open('https://meet.google.com/gvd-nmhs-jjv', '_blank')}
                className="h-full w-full group relative flex flex-col items-center justify-center p-4 text-white transition-all duration-300 bg-slate-900 rounded-2xl hover:bg-slate-800 focus:outline-none border border-purple-500/30 shadow-[0_4px_20px_rgba(168,85,247,0.15)] hover:shadow-[0_4px_25px_rgba(168,85,247,0.25)] hover:-translate-y-1"
            >
                <div className="p-3 bg-white/10 rounded-full mb-3 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                     <Video className="w-6 h-6 text-purple-400 group-hover:text-white" />
                </div>
                <span className="text-sm font-bold tracking-wide text-purple-50">VIDEOCONFERÊNCIA</span>
            </button>
        </div>

      </div>

      {/* --- SEÇÃO INTERMEDIÁRIA: WIDGETS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-2 h-full">
               <MiniClock />
          </div>
          <div className="lg:col-span-2 h-full">
               <MiniCalendar meetings={meetings} />
          </div>
      </div>

      {/* --- SEÇÃO INFERIOR: CARDS DE STATUS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSection 
                title="Notificações" 
                icon={Monitor} 
                colorClass="bg-blue-100 text-blue-600"
                items={[
                    { label: 'Criadas', count: notifCreated, view: ViewState.NOTIFICATIONS_CREATED, subIcon: FileText },
                    { label: 'Entregues', count: notifDelivered, view: ViewState.NOTIFICATIONS_DELIVERED, subIcon: Send },
                    { label: 'Pendentes', count: notifPending, view: ViewState.NOTIFICATIONS_PENDING, subIcon: Clock }
                ]}
            />

            <CardSection 
                title="Conciliações" 
                icon={Video} 
                colorClass="bg-purple-100 text-purple-600"
                items={[
                    { label: 'Agendadas', count: meetScheduled, view: ViewState.CONCILIATIONS_SCHEDULED, subIcon: CalendarIcon },
                    { label: 'Canceladas', count: meetCanceled, view: ViewState.CONCILIATIONS_CANCELED, subIcon: XCircle },
                    { label: 'Realizadas', count: meetDone, view: ViewState.CONCILIATIONS_DONE, subIcon: CheckCircle }
                ]}
            />

            <CardSection 
                title="Pagamentos" 
                icon={CreditCard} 
                colorClass="bg-emerald-100 text-emerald-600"
                items={[
                    { label: 'Confirmados', count: payConfirmed, view: ViewState.PAYMENTS_CONFIRMED, subIcon: CheckCircle },
                    { label: 'Pendentes', count: payPending, view: ViewState.PAYMENTS_PENDING, subIcon: Clock },
                    { label: 'Reembolsados', count: payRefunded, view: ViewState.PAYMENTS_REFUNDED, subIcon: AlertCircle }
                ]}
            />
      </div>
    </div>
  );
};

export default Dashboard;