
import React, { useState, useEffect, useRef } from 'react';
import { Meeting } from '../types';
import { Calendar, Video, Plus, Users, Trash2, Mic, MicOff, Camera, CameraOff, MonitorUp, ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle, History, CalendarDays, ExternalLink } from 'lucide-react';
import { createMeeting, getMeetingsForUser, deleteMeeting } from '../services/meetingService';
import { getUserProfile } from '../services/userService';

interface MeetingSchedulerProps {
    filterStatus?: string[];
    meetingsProp?: Meeting[]; 
}

const MeetingScheduler: React.FC<MeetingSchedulerProps> = ({ filterStatus, meetingsProp }) => {
  const savedUser = localStorage.getItem('mock_session_user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'lobby'>('list');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestCpf, setGuestCpf] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    if (meetingsProp) {
        setMeetings(meetingsProp);
        setLoading(false);
    } else {
        fetchMeetings();
    }
  }, [user, meetingsProp]);

  useEffect(() => {
    return () => stopCamera(); 
  }, []);

  useEffect(() => {
    if(filterStatus && meetings.length > 0) {
        setFilteredMeetings(meetings.filter(m => filterStatus.includes(m.status)));
    } else {
        setFilteredMeetings(meetings);
    }
  }, [meetings, filterStatus]);

  const fetchMeetings = async () => {
    if(!user || !user.email) return;
    setLoading(true);
    try {
        const profile = await getUserProfile(user.uid);
        const data = await getMeetingsForUser(user.uid, user.email, profile?.cpf);
        setMeetings(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;

      try {
          const code = `${Math.random().toString(36).substr(2, 3)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 3)}`;
          const meetLink = `https://meet.google.com/${code}`;

          const newMeeting: Meeting = {
              id: `MEET-${Date.now()}`,
              hostUid: user.uid,
              hostName: user.displayName || 'Anfitrião',
              title,
              date,
              time,
              guestEmail,
              guestCpf: guestCpf.replace(/\D/g, ''),
              meetLink,
              createdAt: new Date().toISOString(),
              status: 'scheduled'
          };

          await createMeeting(newMeeting);
          
          if (!meetingsProp) {
            setMeetings(prev => [...prev, newMeeting].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
          }
          
          setViewMode('list');
          setTitle(''); setDate(''); setTime(''); setGuestEmail(''); setGuestCpf('');
      } catch (e) {
          alert('Erro ao agendar reunião');
      }
  };

  const handleDelete = async (id: string) => {
      if(confirm('Cancelar esta reunião?')) {
          await deleteMeeting(id);
          if (!meetingsProp) {
             setMeetings(prev => prev.filter(m => m.id !== id));
          }
          if(selectedMeeting?.id === id) {
              setViewMode('list');
              setSelectedMeeting(null);
          }
      }
  };

  const startLobby = async (meeting: Meeting) => {
      setSelectedMeeting(meeting);
      if (meeting.status === 'scheduled') {
          setViewMode('lobby');
          startCamera();
      } else {
          setViewMode('lobby'); 
      }
  };

  const startCamera = async () => {
      try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setStream(mediaStream);
          if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
          }
      } catch (e) {
          console.error("Camera error:", e);
      }
  };

  const stopCamera = () => {
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
      }
  };

  const toggleMic = () => {
      if (stream) {
          stream.getAudioTracks().forEach(track => track.enabled = !isMicOn);
          setIsMicOn(!isMicOn);
      }
  };

  const toggleCam = () => {
      if (stream) {
          if (isScreenSharing) {
             handleStopScreenShare();
             return;
          }
          stream.getVideoTracks().forEach(track => track.enabled = !isCamOn);
          setIsCamOn(!isCamOn);
      }
  };

  const handleScreenShare = async () => {
      try {
          if (isScreenSharing) {
              handleStopScreenShare();
              return;
          }
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const screenTrack = screenStream.getVideoTracks()[0];
          
          if (stream && videoRef.current) {
              const currentVideoTrack = stream.getVideoTracks()[0];
              stream.removeTrack(currentVideoTrack);
              stream.addTrack(screenTrack);
              
              screenTrack.onended = () => {
                  handleStopScreenShare();
              };

              setIsScreenSharing(true);
              videoRef.current.srcObject = stream; 
          }
      } catch (error) {
          console.error("Erro ao compartilhar tela:", error);
      }
  };

  const handleStopScreenShare = async () => {
      if (!isScreenSharing) return;
      
      if(stream) {
          stream.getVideoTracks().forEach(track => track.stop());
          stream.removeTrack(stream.getVideoTracks()[0]);
      }

      try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const camTrack = camStream.getVideoTracks()[0];
          if(stream) {
             stream.addTrack(camTrack);
             if(videoRef.current) videoRef.current.srcObject = stream;
          }
          setIsScreenSharing(false);
          setIsCamOn(true);
      } catch(e) {
          console.error("Erro ao reiniciar camera", e);
      }
  };

  const joinGoogleMeet = () => {
      if (selectedMeeting) {
          stopCamera();
          window.open(selectedMeeting.meetLink, '_blank');
      }
  };

  const backToList = () => {
      stopCamera();
      setViewMode('list');
  };

  const getFolderConfig = () => {
      if (!filterStatus || filterStatus.length === 0) return null;
      
      if (filterStatus.includes('scheduled')) {
          return {
              title: 'Conciliações Agendadas',
              desc: 'Próximas audiências e reuniões confirmadas.',
              icon: CalendarDays,
              colorClass: 'bg-blue-100 text-blue-600',
              borderClass: 'border-blue-200'
          };
      }
      if (filterStatus.includes('completed')) {
          return {
              title: 'Realizadas',
              desc: 'Histórico de audiências concluídas.',
              icon: CheckCircle2,
              colorClass: 'bg-green-100 text-green-600',
              borderClass: 'border-green-200'
          };
      }
      if (filterStatus.includes('canceled')) {
          return {
              title: 'Canceladas',
              desc: 'Reuniões canceladas ou reembolsadas.',
              icon: XCircle,
              colorClass: 'bg-red-100 text-red-600',
              borderClass: 'border-red-200'
          };
      }
      return null;
  };

  const folderConfig = getFolderConfig();

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 animate-fade-in overflow-hidden">
      
      {/* LEFT PANEL */}
      <div className={`lg:w-1/3 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${viewMode === 'lobby' ? 'hidden lg:flex' : 'w-full'}`}>
          
          <div className="p-6 border-b border-slate-100">
             {folderConfig ? (
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${folderConfig.colorClass} border ${folderConfig.borderClass}`}>
                            <folderConfig.icon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 leading-tight">{folderConfig.title}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">{folderConfig.desc}</p>
                        </div>
                    </div>
                    {!filterStatus.includes('canceled') && !filterStatus.includes('completed') && (
                        <button 
                            onClick={() => setViewMode('create')}
                            className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-700 transition shadow-sm"
                            title="Nova Reunião"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>
             ) : (
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Conciliações</h2>
                        <p className="text-xs text-slate-500">Todos os agendamentos</p>
                    </div>
                    <button 
                        onClick={() => setViewMode('create')}
                        className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-700 transition"
                    >
                        <Plus size={20} />
                    </button>
                </div>
             )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {loading ? (
                  <div className="text-center py-10 text-slate-400">Carregando...</div>
              ) : filteredMeetings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-100">
                          {folderConfig ? <folderConfig.icon className="text-slate-300" size={24}/> : <Calendar className="text-slate-300" size={24} />}
                      </div>
                      <p className="text-slate-500 text-sm font-medium">Pasta vazia.</p>
                      <p className="text-slate-400 text-xs">Nenhuma reunião encontrada aqui.</p>
                  </div>
              ) : (
                  filteredMeetings.map(meet => (
                      <div 
                        key={meet.id} 
                        onClick={() => startLobby(meet)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md relative overflow-hidden group ${
                            selectedMeeting?.id === meet.id 
                            ? 'bg-white border-blue-400 ring-1 ring-blue-400 shadow-md' 
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              meet.status === 'scheduled' ? 'bg-blue-500' :
                              meet.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>

                          <div className="pl-3">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className={`font-bold text-sm ${selectedMeeting?.id === meet.id ? 'text-blue-700' : 'text-slate-800'}`}>{meet.title}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center ${
                                    meet.status === 'scheduled' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                    meet.status === 'completed' ? 'bg-green-50 text-green-600 border border-green-100' :
                                    'bg-red-50 text-red-600 border border-red-100'
                                }`}>
                                    {meet.status === 'scheduled' ? <Clock size={10} className="mr-1"/> : meet.status === 'completed' ? <CheckCircle2 size={10} className="mr-1"/> : <XCircle size={10} className="mr-1"/>}
                                    {meet.status === 'scheduled' ? 'Agendada' : meet.status === 'completed' ? 'Realizada' : 'Cancelada'}
                                </span>
                            </div>
                            <div className="flex items-center text-xs text-slate-500 mb-3">
                                <Calendar size={12} className="mr-1.5 text-slate-400" />
                                <span className="font-medium text-slate-600">{new Date(meet.date).toLocaleDateString()}</span>
                                <span className="mx-2 text-slate-300">|</span>
                                <Clock size={12} className="mr-1.5 text-slate-400" />
                                <span className="font-medium text-slate-600">{meet.time}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-2">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-white text-[10px] border-2 border-white ring-1 ring-slate-100" title="Você">{user?.displayName?.charAt(0)}</div>
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[10px] border-2 border-white ring-1 ring-slate-100" title="Convidado">C</div>
                                </div>
                                {meet.status === 'scheduled' && (
                                    <button onClick={(e) => {e.stopPropagation(); handleDelete(meet.id);}} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Cancelar Reunião">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative flex flex-col">
          
          {viewMode === 'create' && (
              <div className="p-8 max-w-lg mx-auto w-full animate-fade-in my-auto">
                  <div className="mb-6">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                          <Video size={24} />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800">Novo Agendamento</h2>
                      <p className="text-slate-500">Conciliação ou atendimento virtual</p>
                  </div>
                  <form onSubmit={handleCreate} className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Assunto</label>
                          <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" placeholder="Ex: Acordo Trabalhista" required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" required />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Hora</label>
                            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" required />
                          </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Convidado (Email)</label>
                          <input type="email" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" placeholder="cliente@email.com" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Convidado (CPF - Para Vínculo)</label>
                          <input type="text" value={guestCpf} onChange={e=>setGuestCpf(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" placeholder="000.000.000-00" />
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setViewMode('list')} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                          <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-transform active:scale-95">Agendar</button>
                      </div>
                  </form>
              </div>
          )}

          {viewMode === 'list' && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                      <Video size={40} className="text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-600">Nenhuma reunião selecionada</h3>
                  <p className="max-w-xs text-center text-sm mt-1">Selecione uma conciliação ao lado para ver detalhes ou entrar na sala.</p>
              </div>
          )}

          {viewMode === 'lobby' && selectedMeeting && (
              selectedMeeting.status === 'scheduled' ? (
                  <div className="flex flex-col h-full bg-slate-900 text-white relative">
                      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                          <div>
                              <h3 className="font-bold text-lg">{selectedMeeting.title}</h3>
                              <p className="text-xs text-slate-300 flex items-center">
                                  <ShieldCheck size={12} className="mr-1 text-green-400" />
                                  Conexão Segura Notify
                              </p>
                          </div>
                          <button onClick={backToList} className="text-slate-300 hover:text-white text-sm bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm transition">Voltar</button>
                      </div>

                      <div className="flex-1 flex items-center justify-center relative bg-black">
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isCamOn || isScreenSharing ? 'opacity-100' : 'opacity-0'}`}
                          />
                          
                          {(!isCamOn && !isScreenSharing) && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center animate-pulse border-4 border-slate-700">
                                      <span className="text-4xl font-bold text-slate-500">{user?.displayName?.charAt(0)}</span>
                                  </div>
                              </div>
                          )}

                          <div className="absolute bottom-8 flex items-center gap-4 bg-slate-800/80 backdrop-blur-md p-3 rounded-full border border-slate-700 shadow-2xl z-20">
                              <button onClick={toggleMic} className={`p-4 rounded-full transition ${isMicOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}>
                                  {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                              </button>
                              <button onClick={toggleCam} className={`p-4 rounded-full transition ${isCamOn && !isScreenSharing ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}>
                                  {isCamOn && !isScreenSharing ? <Camera size={20} /> : <CameraOff size={20} />}
                              </button>
                              <div className="w-px h-8 bg-slate-600 mx-2"></div>
                              <button 
                                onClick={handleScreenShare}
                                className={`p-4 rounded-full transition ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}
                                title={isScreenSharing ? "Parar Compartilhamento" : "Compartilhar Tela"}
                              >
                                  <MonitorUp size={20} />
                              </button>
                          </div>
                      </div>

                      <div className="bg-slate-800 p-6 flex flex-col md:flex-row items-center justify-between border-t border-slate-700">
                          <div className="mb-4 md:mb-0 text-center md:text-left">
                              <p className="text-sm text-slate-400 mb-1">Tudo pronto para entrar?</p>
                              <div className="flex items-center text-xs text-slate-500 justify-center md:justify-start">
                                  <Users size={12} className="mr-1" />
                                  <span>Você é o Anfitrião</span>
                              </div>
                          </div>
                          
                          <button 
                            onClick={joinGoogleMeet}
                            className="px-8 py-4 rounded-xl font-bold shadow-lg flex items-center transition transform hover:scale-105 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50"
                          >
                              <ExternalLink size={20} className="mr-2" />
                              Entrar na Sala (Google Meet)
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col h-full bg-slate-50 relative">
                       <button onClick={backToList} className="absolute top-6 left-6 text-slate-500 hover:text-slate-800 text-sm flex items-center">
                           ← Voltar para lista
                       </button>

                       <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
                           <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-sm border-4 border-white ${selectedMeeting.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                               {selectedMeeting.status === 'completed' ? <CheckCircle2 size={48} /> : <XCircle size={48} />}
                           </div>
                           
                           <h2 className="text-2xl font-bold text-slate-800 mb-2">
                               {selectedMeeting.status === 'completed' ? 'Conciliação Realizada' : 'Conciliação Cancelada'}
                           </h2>
                           
                           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full mt-6 text-left">
                               <div className="space-y-4">
                                   <div>
                                       <label className="text-xs font-bold text-slate-400 uppercase">Assunto</label>
                                       <p className="text-slate-800 font-medium">{selectedMeeting.title}</p>
                                   </div>
                                   <div className="grid grid-cols-2 gap-4">
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase">Data Original</label>
                                           <p className="text-slate-800 font-mono text-sm">{new Date(selectedMeeting.date).toLocaleDateString()}</p>
                                       </div>
                                       <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Horário</label>
                                            <p className="text-slate-800 font-mono text-sm">{selectedMeeting.time}</p>
                                       </div>
                                   </div>
                                   <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Convidado</label>
                                        <p className="text-slate-800 text-sm">{selectedMeeting.guestEmail || 'Não informado'}</p>
                                   </div>
                               </div>
                           </div>
                       </div>
                  </div>
              )
          )}

      </div>
    </div>
  );
};

export default MeetingScheduler;
