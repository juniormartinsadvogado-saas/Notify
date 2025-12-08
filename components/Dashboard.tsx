import React, { useState, useEffect } from 'react';
import { ViewState, NotificationItem, Meeting, Transaction, NotificationStatus } from '../types';
import { Plus, Monitor, Video, CreditCard, ChevronRight, FileText, Send, Clock, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle, ChevronLeft, User } from 'lucide-react';

interface DashboardProps {
  notifications: NotificationItem[];
  meetings: Meeting[];
  transactions: Transaction[];
  onNavigate: (view: ViewState) => void;
  user?: any; // Added user prop for profile duplication
}

// --- WIDGET: RELÓGIO ---
const MiniClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-full relative overflow-hidden group hover:border-blue-300 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <Clock size={64} className="text-slate-900" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Horário Oficial</h3>
                <div className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight font-mono">
                    {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-lg text-slate-400 font-normal ml-1">
                         {time.toLocaleTimeString('pt-BR', { second: '2-digit' })}
                    </span>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-600 capitalize">
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
            // m.date formato YYYY-MM-DD
            const [mYear, mMonth, mDay] = m.date.split('-').map(Number);
            return mYear === year && (mMonth - 1) === month && mDay === day;
        });
    };

    const changeMonth = (offset: number) => {
        setCurrDate(new Date(year, month + offset, 1));
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-full flex flex-col group hover:border-purple-300 transition-all">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Agenda de Prazos</h3>
                <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-bold text-slate-800 w-24 text-center capitalize">
                        {currDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={16} /></button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['D','S','T','Q','Q','S','S'].map(d => (
                    <span key={d} className="text-[10px] font-bold text-slate-400">{d}</span>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center flex-1">
                {blanksArray.map(b => <div key={`blank-${b}`} />)}
                {daysArray.map(day => {
                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                    const meetingDay = hasMeeting(day);
                    
                    return (
                        <div key={day} className="flex flex-col items-center justify-center relative h-8 w-8 mx-auto">
                            <span 
                                className={`
                                    text-xs font-medium h-7 w-7 flex items-center justify-center rounded-full transition-colors
                                    ${isToday ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}
                                    ${meetingDay && !isToday ? 'font-bold text-purple-600 bg-purple-50' : ''}
                                `}
                            >
                                {day}
                            </span>
                            {meetingDay && (
                                <span className="absolute bottom-0.5 h-1 w-1 bg-purple-500 rounded-full"></span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 text-[10px] text-slate-400 text-center flex items-center justify-center gap-2">
                <span className="flex items-center"><span className="w-1.5 h-1.5 bg-slate-900 rounded-full mr-1"></span> Hoje</span>
                <span className="flex items-center"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1"></span> Conciliações</span>
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
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-2xl ${colorClass}`}>
                <Icon size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        </div>
        
        <div className="space-y-3">
            {items.map((item, idx) => (
                <button 
                    key={idx}
                    onClick={() => onNavigate(item.view)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-300 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                            <item.subIcon size={18} />
                        </div>
                        <span className="font-medium text-slate-700 text-sm">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100 text-xs">
                            {item.count}
                        </span>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                    </div>
                </button>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-12rem)] animate-fade-in relative overflow-hidden max-w-[1600px] mx-auto w-full pt-6">
      
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] -z-10"></div>
      
      {/* PROFILE WELCOME WIDGET */}
      {user && (
          <div className="w-full max-w-4xl px-4 mb-8 flex flex-col md:flex-row items-center justify-center gap-4 animate-slide-in-down">
              <div className="bg-white rounded-full pl-2 pr-6 py-2 shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 bg-slate-100 shrink-0">
                      {user.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User size={24} />
                          </div>
                      )}
                  </div>
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bem-vindo(a)</p>
                      <h2 className="text-sm font-bold text-slate-800">{user.displayName}</h2>
                  </div>
              </div>
          </div>
      )}

      <div className="text-center max-w-4xl mx-auto mb-10 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-2">
          Painel de Controle
        </h1>
        <p className="text-slate-500 mb-6 font-light">
          Visão geral e administração de tarefas.
        </p>

        {/* Action Buttons Area */}
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center w-full max-w-2xl mx-auto mb-8">
            <button 
            onClick={() => onNavigate(ViewState.CREATE_NOTIFICATION)}
            className="flex-1 w-full group relative inline-flex items-center justify-center px-6 py-4 text-sm font-bold text-white transition-all duration-300 bg-slate-900 rounded-xl hover:scale-105 focus:outline-none 
            border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
            >
                <Plus className="w-5 h-5 mr-2 text-cyan-400" />
                <span className="tracking-wide text-cyan-50">NOVA NOTIFICAÇÃO</span>
            </button>

            <button 
            onClick={() => window.open('https://meet.google.com/gvd-nmhs-jjv', '_blank')}
            className="flex-1 w-full group relative inline-flex items-center justify-center px-6 py-4 text-sm font-bold text-white transition-all duration-300 bg-slate-900 rounded-xl hover:scale-105 focus:outline-none
            border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
            >
                <Video className="w-5 h-5 mr-2 text-purple-400" />
                <span className="tracking-wide text-purple-50">VIDEOCONFERÊNCIA</span>
            </button>
        </div>
      </div>

      {/* --- WIDGETS DE TEMPO --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mx-auto px-4 mb-10">
          <MiniClock />
          <MiniCalendar meetings={meetings} />
      </div>

      {/* Grid de Cards (Pastas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4 md:px-8 pb-10">
            
            {/* CARD NOTIFICAÇÕES */}
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

            {/* CARD CONCILIAÇÕES */}
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

            {/* CARD PAGAMENTOS */}
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