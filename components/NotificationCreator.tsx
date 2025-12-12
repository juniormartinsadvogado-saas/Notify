
import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadEvidence, uploadSignedPdf } from '../services/notificationService';
import { initiateCheckout, saveTransaction, checkPaymentStatus } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { dispatchCommunications } from '../services/communicationService';
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Wand2, Scale, Users, 
  FileText, PenTool, Check, Loader2, 
  Briefcase, ShoppingBag, Home, Heart, FileSignature, Scroll, UploadCloud, X, User, Video, CheckCircle2, ArrowRight, Calendar, ChevronLeft, Sparkles,
  Gavel, Building2, Landmark, GraduationCap, Wifi, Leaf, Car, Stethoscope, Banknote, Copyright, Key, Globe, QrCode, Copy, AlertCircle, Plane, Zap, Rocket, Monitor, Trophy, Anchor, ShieldCheck, ChevronDown, Lightbulb, Printer, Lock, Send, Smartphone, Mail, MessageCircle, Save, LogIn, RefreshCw, Package
} from 'lucide-react';
import { jsPDF } from "jspdf";
import { db } from '../services/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

// --- CONSTANTES DE DADOS ---
const STEPS = [
  { id: 1, label: 'Área', icon: Scale },
  { id: 2, label: 'Fatos', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video },
  { id: 5, label: 'IA', icon: Wand2 },
  { id: 6, label: 'Assinatura', icon: PenTool },
  { id: 7, label: 'Revisão', icon: Package },
  { id: 8, label: 'Pagamento', icon: Banknote },
  { id: 9, label: 'Protocolo', icon: ShieldCheck },
];

const LAW_AREAS = [
  { id: 'civil', name: 'Civil', icon: Scale, desc: 'Relações privadas e obrigações.' },
  { id: 'trabalhista', name: 'Trabalhista', icon: Briefcase, desc: 'Relações de trabalho.' },
  { id: 'consumidor', name: 'Consumidor', icon: ShoppingBag, desc: 'Defesa do consumidor.' },
  { id: 'imobiliario', name: 'Imobiliário', icon: Home, desc: 'Posse e propriedade.' },
  { id: 'contratual', name: 'Contratual', icon: FileSignature, desc: 'Acordos e contratos.' },
  { id: 'familia', name: 'Família', icon: Heart, desc: 'Relações familiares.' },
  { id: 'sucessoes', name: 'Sucessões', icon: Users, desc: 'Heranças e inventários.' },
  { id: 'empresarial', name: 'Empresarial', icon: Building2, desc: 'Atividades empresariais.' },
  { id: 'tributario', name: 'Tributário', icon: Landmark, desc: 'Impostos e taxas.' },
  { id: 'criminal', name: 'Criminal', icon: Gavel, desc: 'Crimes e infrações.' },
  { id: 'administrativo', name: 'Administrativo', icon: Scroll, desc: 'Órgãos públicos.' },
  { id: 'previdenciario', name: 'Previdenciário', icon: GraduationCap, desc: 'INSS e aposentadoria.' },
  { id: 'ambiental', name: 'Ambiental', icon: Leaf, desc: 'Meio ambiente.' },
  { id: 'internacional', name: 'Internacional', icon: Globe, desc: 'Relações estrangeiras.' },
  { id: 'maritimo', name: 'Marítimo', icon: Anchor, desc: 'Direito do mar e portos.' },
  { id: 'aeronautico', name: 'Aeronáutico', icon: Plane, desc: 'Aviação e transporte aéreo.' },
  { id: 'energetico', name: 'Energético', icon: Zap, desc: 'Energia e regulação.' },
  { id: 'espacial', name: 'Espacial', icon: Rocket, desc: 'Atividades espaciais.' },
  { id: 'digital', name: 'Digital', icon: Monitor, desc: 'Internet e dados.' },
  { id: 'esportivo', name: 'Esportivo', icon: Trophy, desc: 'Desporto e justiça desportiva.' }
];

const AREA_SUBTYPES: Record<string, string[]> = {
    'civil': ['Cobrança Indevida', 'Danos Morais', 'Danos Materiais', 'Acidente de Trânsito', 'Vizinhança', 'Obrigação de Fazer'],
    'trabalhista': ['Assédio Moral', 'Verbas Rescisórias', 'Vínculo Empregatício', 'Horas Extras', 'Acidente de Trabalho'],
    'consumidor': ['Produto com Defeito', 'Serviço não Prestado', 'Cobrança Abusiva', 'Negativação Indevida', 'Atraso na Entrega'],
    'imobiliario': ['Atraso de Aluguel', 'Despejo', 'Vícios Construtivos', 'Devolução de Caução', 'Perturbação do Sossego'],
    'contratual': ['Descumprimento Contratual', 'Rescisão Unilateral', 'Revisão de Cláusula', 'Distrato'],
    'familia': ['Alienação Parental', 'Revisão de Alimentos', 'Divórcio Extrajudicial', 'Guarda'],
    'empresarial': ['Concorrência Desleal', 'Uso Indevido de Marca', 'Dissolução de Sociedade', 'Protesto de Títulos'],
    'criminal': ['Calúnia/Difamação', 'Ameaça', 'Stalking', 'Notícia de Crime'],
    'default': ['Notificação Genérica', 'Solicitação de Documentos', 'Pedido de Esclarecimentos']
};

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
  onBack?: () => void;
  subscriptionData?: {
      active: boolean;
      creditsTotal: number;
      creditsUsed: number;
  };
}

interface Address {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface LocalAttachment {
    id: string;
    file: File;
    previewUrl: string;
    name: string;
    type: 'image' | 'video' | 'document';
}

const initialAddress: Address = {
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: ''
};

const MASKS = {
    cpf: (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
    cpfCnpj: (value: string) => {
      const v = value.replace(/\D/g, '');
      if (v.length <= 11) return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
    },
    phone: (value: string) => value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2'),
    cep: (value: string) => value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2')
};

const formatAddressString = (addr: Address) => {
    const parts = [];
    if(addr.street) parts.push(addr.street);
    if(addr.number) parts.push(`nº ${addr.number}`);
    if(addr.complement) parts.push(`Compl: ${addr.complement}`); 
    if(addr.neighborhood) parts.push(addr.neighborhood);
    if(addr.city && addr.state) parts.push(`${addr.city}/${addr.state}`);
    if(addr.cep) parts.push(`CEP ${addr.cep}`);
    return parts.join(', ') || 'Endereço não informado';
};

const DraftingAnimation = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 overflow-hidden">
         <div className="relative">
             <FileText size={48} className="text-blue-500 animate-bounce" />
             <div className="absolute -right-4 -bottom-2 animate-pulse">
                <PenTool size={24} className="text-slate-600" />
             </div>
         </div>
         <p className="mt-8 text-sm font-medium text-slate-500 uppercase tracking-widest animate-pulse">Redigindo Minuta Jurídica...</p>
    </div>
);

const CreativeMeetingSelector: React.FC<{
    date: string;
    time: string;
    setDate: (d: string) => void;
    setTime: (t: string) => void;
    disabled: boolean;
}> = ({ date, time, setDate, setTime, disabled }) => {
    const slots = [8,9,10,11,13,14,15,16].map(h => `${h < 10 ? '0'+h : h}:00`);
    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-inner relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
             <div className="space-y-4 relative z-10">
                <div className="group">
                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1.5 block group-focus-within:text-purple-400 transition-colors">
                        Selecione o Dia (Seg-Sex)
                    </label>
                    <div className="relative bg-slate-900/50 rounded-lg p-1 border border-slate-600 focus-within:border-purple-500 transition-colors flex items-center">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} className="w-full bg-transparent text-white text-sm p-2 outline-none font-medium cursor-pointer" />
                        <Calendar size={16} className="text-slate-400 mr-2 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-2 block">Horário Disponível</label>
                    <div className="grid grid-cols-4 gap-2">
                        {slots.map(slot => (
                            <button key={slot} type="button" onClick={() => setTime(slot)} disabled={disabled} className={`py-1.5 text-xs font-bold rounded-md transition-all border ${time === slot ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                {slot}
                            </button>
                        ))}
                    </div>
                </div>
             </div>
        </div>
    );
};

const PersonForm: React.FC<any> = ({ title, data, section, colorClass, onInputChange, onAddressChange, documentLabel = "CPF ou CNPJ", documentMask = MASKS.cpfCnpj, documentMaxLength = 18, documentPlaceholder }) => {
    return (
        <div className={`bg-white p-4 md:p-6 rounded-2xl border-l-4 ${colorClass} shadow-sm border-t border-r border-b border-slate-200 mb-6`}>
             <h3 className="font-bold text-slate-800 mb-6 flex items-center text-lg">{title}</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo / Razão Social</label>
                    <input type="text" value={data.name} onChange={e => onInputChange(section, 'name', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="Nome" />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{documentLabel}</label>
                    <input type="text" value={data.cpfCnpj} maxLength={documentMaxLength} onChange={e => onInputChange(section, 'cpfCnpj', documentMask(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder={documentPlaceholder} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                    <input type="email" value={data.email} onChange={e => onInputChange(section, 'email', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="email@exemplo.com" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone / WhatsApp</label>
                    <input type="text" value={data.phone} maxLength={15} onChange={e => onInputChange(section, 'phone', MASKS.phone(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="(00) 00000-0000" />
                 </div>
             </div>

             <div className="mt-6 pt-4 border-t border-slate-100">
                 <span className="text-xs font-bold text-slate-400 uppercase block mb-3">Endereço Completo</span>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" placeholder="CEP" value={data.address.cep} onChange={e => onAddressChange(section, 'cep', MASKS.cep(e.target.value))} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" required />
                    <input type="text" placeholder="Rua" value={data.address.street} onChange={e => onAddressChange(section, 'street', e.target.value)} className="col-span-1 md:col-span-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" required />
                    <input type="text" placeholder="Número" value={data.address.number} onChange={e => onAddressChange(section, 'number', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" required />
                    <input type="text" placeholder="Complemento" value={data.address.complement} onChange={e => onAddressChange(section, 'complement', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" />
                    <input type="text" placeholder="Bairro" value={data.address.neighborhood} onChange={e => onAddressChange(section, 'neighborhood', e.target.value)} className="col-span-1 md:col-span-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" required />
                    <input type="text" placeholder="Cidade" value={data.address.city} onChange={e => onAddressChange(section, 'city', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" required />
                    <input type="text" placeholder="UF" value={data.address.state} maxLength={2} onChange={e => onAddressChange(section, 'state', e.target.value.toUpperCase())} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-400 outline-none" required />
                 </div>
             </div>
        </div>
    );
};

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user, onBack, subscriptionData }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [error, setError] = useState('');
  const [notificationId, setNotificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  
  const [role, setRole] = useState<'self' | 'representative' | null>(null);
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    areaId: '', species: '', facts: '',
    representative: { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } },
    sender: { name: user?.displayName || '', cpfCnpj: '', email: user?.email || '', phone: '', address: { ...initialAddress } },
    recipient: { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } },
    scheduleMeeting: false, meetingDate: '', meetingTime: '', subject: '', tone: 'Jurídico Formal', generatedContent: '', signed: false,
  });

  const [localFiles, setLocalFiles] = useState<LocalAttachment[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false); 
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null); 
  const [createdData, setCreatedData] = useState<{notif?: NotificationItem, meet?: Meeting, trans?: Transaction}>({});

  const currentArea = LAW_AREAS.find(a => a.id === formData.areaId);
  const availableSubtypes = currentArea ? (AREA_SUBTYPES[currentArea.id] || AREA_SUBTYPES['default']) : [];

  // Scroll to step
  useEffect(() => {
    if (stepperRef.current) {
      const activeStepEl = document.getElementById(`step-${currentStep}`);
      if (activeStepEl) activeStepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentStep]);

  // Draft saving logic
  useEffect(() => {
      const STORAGE_KEY = `notify_draft_${user?.uid}`;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) { 
                  setFormData(parsed.data);
                  setCurrentStep(parsed.step);
                  setNotificationId(parsed.id || notificationId);
                  setSignatureData(parsed.signature || null);
              } else localStorage.removeItem(STORAGE_KEY);
          } catch(e) { console.error("Erro rascunho", e); }
      }
  }, [user?.uid]);

  useEffect(() => {
      const STORAGE_KEY = `notify_draft_${user?.uid}`;
      if (currentStep > 1 && currentStep < 8) { 
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), step: currentStep, data: formData, id: notificationId, signature: signatureData }));
      }
  }, [formData, currentStep, signatureData, user?.uid, notificationId]);

  const saveDraftToFirestore = async () => {
      if (!user || currentStep < 2) return;
      const draftNotif: NotificationItem = {
          id: notificationId,
          notificante_uid: user.uid,
          notificante_cpf: formData.sender.cpfCnpj.replace(/\D/g, ''),
          notificante_dados_expostos: { nome: formData.sender.name, email: formData.sender.email, telefone: formData.sender.phone, foto_url: user.photoURL || undefined },
          notificados_cpfs: [formData.recipient.cpfCnpj.replace(/\D/g, '')],
          recipientName: formData.recipient.name, recipientEmail: formData.recipient.email, recipientPhone: formData.recipient.phone,
          recipientDocument: formData.recipient.cpfCnpj, recipientAddress: formatAddressString(formData.recipient.address),
          area: currentArea?.name || '', species: formData.species, facts: formData.facts, subject: formData.subject || formData.species || 'Rascunho',
          content: formData.generatedContent, evidences: [], createdAt: new Date().toISOString(), status: NotificationStatus.DRAFT, paymentAmount: calculateTotal()
      };
      try { await saveNotification(draftNotif); } catch (e) { console.error("Erro rascunho auto:", e); }
  };

  const clearDraft = () => localStorage.removeItem(`notify_draft_${user?.uid}`);

  // Payment Check Logic
  useEffect(() => {
      if (currentStep === 8 && createdData.notif) {
          if (!pixData && !isProcessingAction) generatePix();
          const checkInterval = setInterval(async () => {
              if (asaasPaymentId) {
                  try {
                      const result = await checkPaymentStatus(asaasPaymentId);
                      if (result.paid) { clearInterval(checkInterval); handlePaymentConfirmed(); }
                  } catch (e) {}
              }
          }, 3500); 
          const unsub = onSnapshot(doc(db, 'notificacoes', createdData.notif.id), (docSnapshot) => {
             const data = docSnapshot.data();
             if (data && (data.status === 'SENT' || data.status === 'Enviada')) { clearInterval(checkInterval); handlePaymentConfirmed(); }
          });
          return () => { clearInterval(checkInterval); unsub(); };
      }
  }, [currentStep, createdData.notif, asaasPaymentId]);

  const generatePix = async () => {
      setIsProcessingAction(true); setError('');
      try {
          if(!user || !createdData.notif) return;
          const checkoutResponse = await initiateCheckout(createdData.notif, 'single', 'PIX');
          if (!checkoutResponse.success) { setError(checkoutResponse.error || "Erro ao gerar Pix."); return; }
          if (checkoutResponse.pixData) {
              setPixData(checkoutResponse.pixData);
              if (checkoutResponse.paymentId) setAsaasPaymentId(checkoutResponse.paymentId);
          }
      } catch (e) { setError("Erro de comunicação com Asaas."); } finally { setIsProcessingAction(false); }
  };

  const manualVerifyPayment = async () => {
      if(!asaasPaymentId) return;
      setIsProcessingAction(true);
      try {
          const result = await checkPaymentStatus(asaasPaymentId);
          if (result.paid) handlePaymentConfirmed();
          else alert("O sistema bancário ainda não confirmou o Pix. Aguarde.");
      } catch(e) { alert("Erro ao verificar."); } finally { setIsProcessingAction(false); }
  };

  const handlePaymentConfirmed = async () => {
      if (!user || !createdData.notif || !createdData.trans) return;
      setCurrentStep(9); setIsDispatching(true);
      const updatedNotif = { ...createdData.notif, status: NotificationStatus.SENT };
      const updatedTrans: Transaction = { ...createdData.trans, status: 'Pago' };
      await saveTransaction(user.uid, updatedTrans);
      try { await dispatchCommunications(updatedNotif); } catch (err) { console.error("Erro disparo:", err); }
      setCreatedData({ notif: updatedNotif, meet: createdData.meet, trans: updatedTrans });
      setIsDispatching(false); clearDraft();
  };

  const calculateTotal = () => 57.92;
  const handleInputChange = (s: any, f: any, v: any) => setFormData(p => ({ ...p, [s]: { ...p[s], [f]: v } }));
  const handleAddressChange = (s: any, f: any, v: any) => setFormData(p => ({ ...p, [s]: { ...p[s], address: { ...p[s].address, [f]: v } } }));
  const handleDateChange = (d: any) => setFormData(p => ({ ...p, meetingDate: d }));
  const handleTimeChange = (t: any) => setFormData(p => ({ ...p, meetingTime: t }));

  // File logic
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const newFile: LocalAttachment = {
              id: Math.random().toString(36),
              file,
              name: file.name,
              type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
              previewUrl: URL.createObjectURL(file)
          };
          setLocalFiles(prev => [...prev, newFile]);
      }
  };
  const removeFile = (id: string) => setLocalFiles(p => p.filter(f => f.id !== id));

  // Signature logic
  const startDrawing = (e: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      setIsDrawing(true);
      const { offsetX, offsetY } = getCoordinates(e, canvas);
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
  };
  const draw = (e: any) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { offsetX, offsetY } = getCoordinates(e, canvas);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
  };
  const endDrawing = () => {
      setIsDrawing(false);
      if (canvasRef.current) setSignatureData(canvasRef.current.toDataURL());
  };
  const getCoordinates = (e: any, canvas: HTMLCanvasElement) => {
      if (e.touches && e.touches[0]) {
          const rect = canvas.getBoundingClientRect();
          return { offsetX: e.touches[0].clientX - rect.left, offsetY: e.touches[0].clientY - rect.top };
      }
      return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
  };
  const clearSignature = () => {
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          setSignatureData(null);
      }
  };

  const handleGenerateContent = async () => {
    if (!formData.species || !formData.facts) { alert("Erro: Preencha Fatos e Tipo."); return; }
    setIsGenerating(true);
    try {
        const attachments: Attachment[] = localFiles.map(lf => ({ file: lf.file, preview: lf.previewUrl, type: lf.type }));
        const contextInfo = { area: currentArea?.name || '', species: formData.species, areaDescription: currentArea?.desc || '' };
        let details = `Fatos: ${formData.facts}\nRemetente: ${formData.sender.name} (CPF/CNPJ: ${formData.sender.cpfCnpj})\nEndereço Remetente: ${formatAddressString(formData.sender.address)}\nDestinatário: ${formData.recipient.name} (CPF/CNPJ: ${formData.recipient.cpfCnpj})\nEndereço Destinatário: ${formatAddressString(formData.recipient.address)}`;
        if (formData.scheduleMeeting) details += `\n[IMPORTANTE] Reunião agendada para ${new Date(formData.meetingDate).toLocaleDateString()} às ${formData.meetingTime}. Inclua parágrafo de conciliação.`;
        
        const text = await generateNotificationText(formData.recipient.name, formData.subject || formData.species, details, formData.tone, attachments, contextInfo);
        setFormData(prev => ({ ...prev, generatedContent: text }));
        await saveDraftToFirestore();
        setCurrentStep(6); 
    } catch (err: any) { alert(`Erro IA: ${err.message}`); } finally { setIsGenerating(false); }
  };

  const handlePersistData = async () => {
      setIsSavingData(true); setError('');
      let finalNotif: NotificationItem | null = null;
      let newTrans: Transaction | null = null;
      let newMeet: Meeting | undefined = undefined;

      try {
          if (!user) throw new Error("Usuário não autenticado");
          const uniqueHash = documentHash || Array.from({length: 4}, () => Math.random().toString(36).substr(2, 4).toUpperCase()).join('-');
          if (!documentHash) setDocumentHash(uniqueHash);
          
          let pdfUrl = '';
          try { pdfUrl = await generateAndUploadPdf(uniqueHash); } catch (e) { console.error("Erro PDF:", e); }

          const newEvidenceItems: EvidenceItem[] = [];
          for (const lf of localFiles) { try { newEvidenceItems.push(await uploadEvidence(notificationId, lf.file)); } catch (e) {} }

          const totalAmount = calculateTotal();

          finalNotif = {
              id: notificationId, documentHash: uniqueHash, notificante_uid: user.uid,
              notificante_cpf: formData.sender.cpfCnpj.replace(/\D/g, ''),
              notificante_dados_expostos: { nome: formData.sender.name, email: formData.sender.email, telefone: formData.sender.phone, foto_url: user.photoURL || undefined },
              notificados_cpfs: [formData.recipient.cpfCnpj.replace(/\D/g, '')],
              recipientName: formData.recipient.name, recipientEmail: formData.recipient.email, recipientPhone: formData.recipient.phone,
              recipientDocument: formData.recipient.cpfCnpj, recipientAddress: formatAddressString(formData.recipient.address),
              area: currentArea?.name || '', species: formData.species, facts: formData.facts, subject: formData.subject || formData.species,
              content: formData.generatedContent, evidences: newEvidenceItems, pdf_url: pdfUrl, signatureBase64: signatureData || undefined,
              createdAt: new Date().toISOString(), status: NotificationStatus.PENDING_PAYMENT, paymentAmount: totalAmount
          };

          await saveNotification(finalNotif);

          // CRIAÇÃO DA TRANSAÇÃO PENDENTE (COM NOVOS CAMPOS)
          newTrans = {
              id: `TX-${Date.now()}`,
              description: `Notificação - ${formData.species}`,
              amount: totalAmount,
              date: new Date().toISOString(),
              status: 'Pendente',
              // NOVOS CAMPOS PARA HISTÓRICO DETALHADO
              recipientName: formData.recipient.name,
              notificationId: notificationId
          };

          if (formData.scheduleMeeting) {
              try {
                  newMeet = {
                      id: `MEET-${Date.now()}`, hostUid: user.uid, hostName: user.displayName || 'Anfitrião', title: `Conciliação: ${formData.species}`,
                      date: formData.meetingDate, time: formData.meetingTime, guestEmail: formData.recipient.email, guestCpf: formData.recipient.cpfCnpj,
                      meetLink: `https://meet.google.com/xyz-abc`, createdAt: new Date().toISOString(), status: 'scheduled' 
                  };
                  await createMeeting(newMeet);
              } catch (e) {}
          }

          setCreatedData({ notif: finalNotif, meet: newMeet, trans: newTrans });
          setTimeout(() => setCurrentStep(7), 100); 

      } catch (e: any) { console.error(e); alert(e.message); } finally { setIsSavingData(false); }
  };

  const generateAndUploadPdf = async (docHash: string): Promise<string> => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 20;
      let y = margin;
      
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("NOTIFICAÇÃO EXTRAJUDICIAL", 105, y, { align: "center" });
      y += 15;

      doc.setFontSize(10);
      doc.setFont("times", "normal");
      doc.text(`${formData.sender.address.city || 'Local'}, ${new Date().toLocaleDateString('pt-BR', {day: 'numeric', month: 'long', year: 'numeric'})}`, 105, y, { align: "center" });
      y += 15;

      doc.setFont("times", "bold");
      doc.text("NOTIFICANTE:", margin, y);
      doc.setFont("times", "normal");
      const remetenteText = `${formData.sender.name}, inscrito no CPF/CNPJ sob nº ${formData.sender.cpfCnpj}, residente em ${formatAddressString(formData.sender.address)}.`;
      const splitRemetente = doc.splitTextToSize(remetenteText, 170);
      doc.text(splitRemetente, margin, y + 5);
      y += 10 + (splitRemetente.length * 4);

      doc.setFont("times", "bold");
      doc.text("NOTIFICADO:", margin, y);
      doc.setFont("times", "normal");
      const destText = `${formData.recipient.name}, inscrito no CPF/CNPJ sob nº ${formData.recipient.cpfCnpj}, residente em ${formatAddressString(formData.recipient.address)}.`;
      const splitDest = doc.splitTextToSize(destText, 170);
      doc.text(splitDest, margin, y + 5);
      y += 15 + (splitDest.length * 4);

      doc.setFont("times", "bold");
      doc.text("ASSUNTO:", margin, y);
      doc.setFont("times", "normal");
      doc.text(formData.subject || formData.species, margin + 25, y);
      y += 15;

      // Conteúdo
      doc.setFontSize(11);
      const splitContent = doc.splitTextToSize(formData.generatedContent, 170);
      
      if (y + (splitContent.length * 5) > 280) {
          doc.addPage();
          y = margin;
      }
      doc.text(splitContent, margin, y);
      y += (splitContent.length * 5) + 20;

      // Assinatura
      if (signatureData) {
          if (y > 240) { doc.addPage(); y = 40; }
          doc.addImage(signatureData, 'PNG', 105 - 25, y, 50, 25);
          y += 30;
          doc.line(75, y, 135, y);
          doc.text(formData.sender.name, 105, y + 5, { align: "center" });
      }

      // Hash footer
      const pageCount = doc.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Documento assinado digitalmente via Notify. Hash: ${docHash} - Pág ${i}/${pageCount}`, 105, 290, { align: 'center' });
      }

      const pdfBlob = doc.output('blob');
      return await uploadSignedPdf(notificationId, pdfBlob);
  };

  // --- RENDER SCREENS (RESTAURADOS) ---

  const renderProtocolScreen = () => (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 size={48} className="text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Sucesso!</h2>
          <p className="text-slate-600 mb-8 max-w-md">
              Sua notificação foi registrada, assinada e enviada para processamento.
              Você pode acompanhar o status de entrega no painel.
          </p>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full max-w-md mb-8 text-left">
              <div className="flex justify-between mb-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Protocolo</span>
                  <span className="font-mono font-bold text-slate-800">{notificationId}</span>
              </div>
              <div className="flex justify-between mb-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="text-green-600 font-bold flex items-center"><Check size={14} className="mr-1"/> Enviado</span>
              </div>
              <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Hash de Segurança</span>
                  <span className="font-mono text-xs text-slate-400 truncate max-w-[150px]">{documentHash}</span>
              </div>
          </div>

          <div className="flex gap-4">
              <button 
                onClick={() => onSave(createdData.notif!, createdData.meet, createdData.trans)}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center"
              >
                  <Home size={18} className="mr-2" />
                  Voltar ao Painel
              </button>
          </div>
      </div>
  );

  const renderPackageScreen = () => (
      <div className="animate-fade-in space-y-8">
          <div className="text-center mb-8">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4">
                   <Package size={32} />
               </div>
               <h2 className="text-2xl font-bold text-slate-800">Revisão Final</h2>
               <p className="text-slate-500">Confira os detalhes antes de finalizar o documento.</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
               
               <div className="flex justify-between items-start mb-6">
                   <div>
                       <h3 className="font-bold text-lg text-slate-800 flex items-center">
                           <FileText size={18} className="mr-2 text-blue-500"/> Minuta da Notificação
                       </h3>
                       <p className="text-xs text-slate-400 mt-1">Gerada por IA • {new Date().toLocaleDateString()}</p>
                   </div>
                   <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100 flex items-center">
                       <PenTool size={12} className="mr-1"/> Assinada Digitalmente
                   </div>
               </div>

               <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 font-serif text-slate-700 text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto shadow-inner">
                   {formData.generatedContent}
               </div>

               <div className="mt-6 flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-4">
                   <span><strong>Remetente:</strong> {formData.sender.name}</span>
                   <span><strong>Destinatário:</strong> {formData.recipient.name}</span>
               </div>
          </div>

          <div className="flex justify-between items-center pt-4">
              <button onClick={() => setCurrentStep(6)} className="text-slate-500 hover:text-slate-800 font-medium flex items-center">
                  <ChevronLeft size={18} className="mr-1" /> Voltar e Editar
              </button>
              <button 
                onClick={() => { setCurrentStep(8); handlePersistData(); }}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center group"
              >
                  {isSavingData ? <Loader2 className="animate-spin mr-2"/> : <ArrowRight size={18} className="mr-2 group-hover:translate-x-1 transition-transform" />}
                  Finalizar e Ir para Pagamento
              </button>
          </div>
      </div>
  );

  const renderPaymentScreen = () => (
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
          {/* Coluna Esquerda: Resumo */}
          <div className="space-y-6">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center">
                       <ShoppingBag size={18} className="mr-2 text-slate-400"/> Resumo do Pedido
                   </h3>
                   <div className="space-y-3">
                       <div className="flex justify-between text-sm text-slate-600">
                           <span>Criação e Validação Jurídica (IA)</span>
                           <span className="font-bold">R$ 29,90</span>
                       </div>
                       <div className="flex justify-between text-sm text-slate-600">
                           <span>Envio Certificado (E-mail + WhatsApp)</span>
                           <span className="font-bold">R$ 19,90</span>
                       </div>
                       <div className="flex justify-between text-sm text-slate-600">
                           <span>Registro de Blockchain (Hash)</span>
                           <span className="font-bold">R$ 8,12</span>
                       </div>
                       <div className="border-t border-slate-100 pt-3 flex justify-between items-center mt-2">
                           <span className="font-bold text-slate-800">Total</span>
                           <span className="text-2xl font-bold text-emerald-600">R$ 57,92</span>
                       </div>
                   </div>
               </div>
               
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-700 flex items-start">
                   <ShieldCheck size={18} className="mr-2 mt-0.5 shrink-0" />
                   <p>Pagamento seguro processado via Asaas. Seus dados estão protegidos por criptografia de ponta a ponta.</p>
               </div>
          </div>

          {/* Coluna Direita: QR Code */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 flex flex-col items-center text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
               
               <h3 className="text-xl font-bold text-slate-800 mb-2">Pagamento via Pix</h3>
               <p className="text-slate-500 text-sm mb-6">Escaneie o QR Code ou copie o código abaixo para liberar o envio imediato.</p>
               
               {isProcessingAction && !pixData ? (
                   <div className="py-12 flex flex-col items-center">
                       <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                       <span className="text-slate-400 text-sm">Gerando cobrança segura...</span>
                   </div>
               ) : pixData ? (
                   <div className="w-full flex flex-col items-center animate-fade-in">
                       <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-inner mb-6 relative group">
                           <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="Pix QR" className="w-56 h-56" />
                           <div className="absolute inset-0 border-b-2 border-emerald-500 opacity-50 animate-[scan_2s_linear_infinite] pointer-events-none"></div>
                       </div>
                       
                       <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 mb-6">
                           <span className="text-xs text-slate-500 truncate font-mono">{pixData.payload}</span>
                           <button 
                             onClick={() => {navigator.clipboard.writeText(pixData.payload); alert("Copiado!");}}
                             className="text-blue-600 hover:text-blue-700 font-bold text-xs whitespace-nowrap"
                           >
                               COPIAR
                           </button>
                       </div>

                       <div className="flex items-center text-emerald-600 text-sm font-bold animate-pulse mb-4">
                           <RefreshCw size={16} className="mr-2 animate-spin"/>
                           Aguardando confirmação automática...
                       </div>
                       
                       <button onClick={manualVerifyPayment} className="text-xs text-slate-400 hover:text-slate-600 underline">
                           Já paguei, verificar agora
                       </button>
                   </div>
               ) : (
                   <div className="py-12 text-red-500">Erro ao carregar Pix. Tente novamente.</div>
               )}
          </div>
      </div>
  );

  return (
      <div className="max-w-5xl mx-auto pb-24 relative">
          
          {/* --- HEADER COM BOTÃO VOLTAR --- */}
          <div className="flex items-center mb-8">
              <button 
                  onClick={onBack} 
                  className="mr-4 p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                  title="Voltar ao Dashboard"
              >
                  <ChevronLeft size={24} />
              </button>
              <div>
                  <h1 className="text-2xl font-bold text-slate-800">Nova Notificação Extrajudicial</h1>
                  <p className="text-slate-500 text-sm">Crie, valide e envie documentos com validade jurídica em minutos.</p>
              </div>
          </div>

          {/* --- STEPPER PROGRESS --- */}
          <div className="mb-10 overflow-x-auto pb-4" ref={stepperRef}>
              <div className="flex items-center min-w-max px-2">
                  {STEPS.map((step, index) => {
                      const isActive = step.id === currentStep;
                      const isCompleted = step.id < currentStep;
                      
                      return (
                          <div key={step.id} id={`step-${step.id}`} className="flex items-center">
                              <div className={`flex flex-col items-center relative group ${isActive ? 'scale-110' : 'opacity-60'} transition-all duration-300`}>
                                  <div className={`
                                      w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm border-2 transition-colors z-10
                                      ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 
                                        isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                                        'bg-white border-slate-200 text-slate-400'}
                                  `}>
                                      {isCompleted ? <Check size={18} /> : <step.icon size={18} />}
                                  </div>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                                      {step.label}
                                  </span>
                              </div>
                              {index < STEPS.length - 1 && (
                                  <div className={`w-12 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>

          {/* --- CONTEÚDO PRINCIPAL --- */}
          <div className="animate-fade-in min-h-[400px]">
              
              {/* STEP 1: ÁREAS */}
              {currentStep === 1 && (
                  <>
                      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center"><Scale size={24} className="mr-2 text-blue-500"/> Selecione a Área Jurídica</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {LAW_AREAS.map((area) => (
                              <button
                                  key={area.id}
                                  onClick={() => { setFormData({...formData, areaId: area.id}); setCurrentStep(2); }}
                                  className={`p-6 rounded-2xl border transition-all hover:shadow-lg text-left group relative overflow-hidden ${
                                      formData.areaId === area.id 
                                      ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                      : 'bg-white border-slate-200 hover:border-blue-300'
                                  }`}
                              >
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${formData.areaId === area.id ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                                      <area.icon size={24} />
                                  </div>
                                  <h3 className={`font-bold mb-1 ${formData.areaId === area.id ? 'text-blue-700' : 'text-slate-800'}`}>{area.name}</h3>
                                  <p className="text-xs text-slate-500 leading-relaxed">{area.desc}</p>
                              </button>
                          ))}
                      </div>
                  </>
              )}

              {/* STEP 2: FATOS E SUBTIPOS */}
              {currentStep === 2 && (
                  <div className="max-w-3xl mx-auto">
                      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center"><FileText size={24} className="mr-2 text-blue-500"/> Detalhes do Caso</h2>
                      
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Classificação Específica</label>
                          <div className="flex flex-wrap gap-2 mb-6">
                              {availableSubtypes.map(sub => (
                                  <button
                                      key={sub}
                                      onClick={() => setFormData({...formData, species: sub})}
                                      className={`px-4 py-2 rounded-full text-xs font-bold transition-colors border ${
                                          formData.species === sub 
                                          ? 'bg-blue-600 text-white border-blue-600' 
                                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'
                                      }`}
                                  >
                                      {sub}
                                  </button>
                              ))}
                          </div>

                          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Narrativa dos Fatos</label>
                          <textarea 
                              value={formData.facts}
                              onChange={(e) => setFormData({...formData, facts: e.target.value})}
                              className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-sm resize-none"
                              placeholder="Descreva detalhadamente o ocorrido. Ex: Data, local, valores envolvidos, o que foi acordado e o que foi descumprido..."
                          />
                          <p className="text-right text-xs text-slate-400 mt-2">{formData.facts.length} caracteres</p>
                      </div>

                      {/* UPLOAD DE EVIDÊNCIAS */}
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                          <div className="flex justify-between items-center mb-4">
                               <h3 className="font-bold text-sm text-slate-700 flex items-center"><UploadCloud size={16} className="mr-2 text-purple-500"/> Evidências (Opcional)</h3>
                               <label className="cursor-pointer bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                                   + Adicionar Arquivo
                                   <input type="file" className="hidden" multiple onChange={handleFileSelect} />
                               </label>
                          </div>
                          
                          {localFiles.length === 0 ? (
                              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
                                  <p className="text-xs text-slate-400">Nenhum arquivo anexado.</p>
                              </div>
                          ) : (
                              <div className="space-y-2">
                                  {localFiles.map(file => (
                                      <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <div className="flex items-center overflow-hidden">
                                              {file.type === 'image' && <img src={file.previewUrl} className="w-8 h-8 rounded object-cover mr-3" />}
                                              <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                                          </div>
                                          <button onClick={() => removeFile(file.id)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="flex justify-end mt-6">
                          <button 
                              onClick={() => { if(!formData.species || !formData.facts) return alert("Preencha os campos obrigatórios"); setCurrentStep(3); }} 
                              className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center"
                          >
                              Continuar <ArrowRight size={18} className="ml-2"/>
                          </button>
                      </div>
                  </div>
              )}

              {/* STEP 3: PARTES */}
              {currentStep === 3 && (
                  <div className="max-w-4xl mx-auto">
                      <div className="flex justify-center mb-8">
                          <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner">
                              <button 
                                onClick={() => setPartiesStep('role_selection')} 
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${partiesStep === 'role_selection' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                              >
                                  1. Seleção de Papel
                              </button>
                              <button 
                                onClick={() => role && setPartiesStep('forms')} 
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${partiesStep === 'forms' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                                disabled={!role}
                              >
                                  2. Dados das Partes
                              </button>
                          </div>
                      </div>

                      {partiesStep === 'role_selection' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                              <button 
                                onClick={() => { setRole('self'); setPartiesStep('forms'); }}
                                className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group text-left"
                              >
                                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                      <User size={32} />
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-800 mb-2">Sou o Próprio Notificante</h3>
                                  <p className="text-slate-500 text-sm">Estou criando este documento em meu nome ou em nome da minha empresa.</p>
                              </button>

                              <button 
                                onClick={() => { setRole('representative'); setPartiesStep('forms'); }}
                                className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all group text-left"
                              >
                                  <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                      <Briefcase size={32} />
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-800 mb-2">Sou Advogado/Representante</h3>
                                  <p className="text-slate-500 text-sm">Estou agindo em nome de um cliente (Pessoa Física ou Jurídica).</p>
                              </button>
                          </div>
                      ) : (
                          <div className="animate-fade-in space-y-8">
                              {role === 'representative' && (
                                  <PersonForm 
                                    title="Dados do Representante (Você)" 
                                    section="representative" 
                                    data={formData.representative} 
                                    colorClass="border-purple-500"
                                    onInputChange={handleInputChange}
                                    onAddressChange={handleAddressChange}
                                  />
                              )}

                              <PersonForm 
                                title="Dados do Remetente (Quem Envia)" 
                                section="sender" 
                                data={formData.sender} 
                                colorClass="border-blue-500"
                                onInputChange={handleInputChange}
                                onAddressChange={handleAddressChange}
                              />

                              <PersonForm 
                                title="Dados do Destinatário (Quem Recebe)" 
                                section="recipient" 
                                data={formData.recipient} 
                                colorClass="border-red-500"
                                onInputChange={handleInputChange}
                                onAddressChange={handleAddressChange}
                              />

                              <div className="flex justify-between pt-6">
                                  <button onClick={() => setPartiesStep('role_selection')} className="text-slate-500 hover:text-slate-800 font-medium">Voltar</button>
                                  <button onClick={() => setCurrentStep(4)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center">Continuar <ArrowRight size={18} className="ml-2"/></button>
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* STEP 4: CONCILIAÇÃO */}
              {currentStep === 4 && (
                  <div className="max-w-2xl mx-auto text-center">
                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
                           <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                               <Video size={32} />
                           </div>
                           <h2 className="text-2xl font-bold text-slate-800 mb-2">Propor Conciliação?</h2>
                           <p className="text-slate-500 mb-8">Você pode agendar uma reunião virtual automática para tentar um acordo amigável antes de litigar.</p>
                           
                           <div className="flex justify-center gap-4 mb-8">
                               <button 
                                  onClick={() => setFormData({...formData, scheduleMeeting: true})}
                                  className={`px-6 py-3 rounded-xl font-bold border-2 transition-all ${formData.scheduleMeeting ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-green-300'}`}
                               >
                                  Sim, agendar reunião
                               </button>
                               <button 
                                  onClick={() => setFormData({...formData, scheduleMeeting: false})}
                                  className={`px-6 py-3 rounded-xl font-bold border-2 transition-all ${!formData.scheduleMeeting ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                               >
                                  Não, apenas notificar
                               </button>
                           </div>

                           {formData.scheduleMeeting && (
                               <div className="animate-fade-in text-left bg-slate-50 p-6 rounded-xl border border-slate-200">
                                   <CreativeMeetingSelector 
                                      date={formData.meetingDate} 
                                      time={formData.meetingTime} 
                                      setDate={handleDateChange} 
                                      setTime={handleTimeChange}
                                      disabled={false}
                                   />
                               </div>
                           )}
                      </div>

                      <button onClick={handleGenerateContent} className="w-full bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center justify-center text-lg group">
                          <Sparkles size={20} className="mr-3 text-yellow-400 group-hover:animate-spin" />
                          Gerar Minuta com IA
                      </button>
                  </div>
              )}

              {/* STEP 5: LOADING IA */}
              {currentStep === 5 && isGenerating && (
                  <div className="h-[400px] relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <DraftingAnimation />
                  </div>
              )}

              {/* STEP 6: ASSINATURA */}
              {currentStep === 6 && (
                  <div className="max-w-2xl mx-auto">
                      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center"><PenTool size={24} className="mr-2 text-blue-500"/> Assinatura Digital</h2>
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                          <p className="text-sm text-slate-500 mb-4">Assine no quadro abaixo para validar o documento juridicamente.</p>
                          <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative h-64 touch-none cursor-crosshair overflow-hidden">
                              <canvas 
                                  ref={canvasRef}
                                  className="w-full h-full"
                                  width={600}
                                  height={256}
                                  onMouseDown={startDrawing}
                                  onMouseMove={draw}
                                  onMouseUp={endDrawing}
                                  onMouseLeave={endDrawing}
                                  onTouchStart={startDrawing}
                                  onTouchMove={draw}
                                  onTouchEnd={endDrawing}
                              />
                              <button onClick={clearSignature} className="absolute top-2 right-2 text-xs text-red-500 bg-white px-2 py-1 rounded shadow-sm border border-red-100 hover:bg-red-50">Limpar</button>
                              {!isDrawing && !signatureData && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 font-bold text-2xl opacity-50">ASSINE AQUI</div>}
                          </div>
                      </div>
                      <div className="flex justify-end">
                           <button 
                              onClick={() => { if(!signatureData) return alert("A assinatura é obrigatória."); setCurrentStep(7); }} 
                              className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center"
                           >
                              Confirmar Assinatura <ArrowRight size={18} className="ml-2"/>
                           </button>
                      </div>
                  </div>
              )}

              {/* STEP 7: REVISÃO */}
              {currentStep === 7 && renderPackageScreen()}

              {/* STEP 8: PAGAMENTO */}
              {currentStep === 8 && renderPaymentScreen()}

              {/* STEP 9: PROTOCOLO */}
              {currentStep === 9 && renderProtocolScreen()}
          </div>
      </div>
  );
};

export default NotificationCreator;
