
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

// CONSTANTES E ARRAYS DE DADOS (Mantidos inalterados para brevidade, mas devem existir no arquivo completo)
const STEPS = [
  { id: 1, label: 'Áreas', icon: Scale },
  { id: 2, label: 'Fatos', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video },
  { id: 5, label: 'Geração IA', icon: Wand2 },
  { id: 6, label: 'Assinatura', icon: PenTool },
  { id: 7, label: 'Envio', icon: Package },
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

const FACTS_SUGGESTIONS = [
    "Atraso no pagamento de aluguel referente ao mês de...",
    "Produto entregue com defeito e recusa de troca...",
    "Violação de contrato de prestação de serviços...",
    "Uso indevido de imagem sem autorização...",
    "Perturbação do sossego (Lei do Silêncio)..."
];

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
  // ... (Estados e useEffects mantidos)
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [error, setError] = useState('');
  const [notificationId, setNotificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');
  const [role, setRole] = useState<'self' | 'representative' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // ... (Outros useEffects e métodos mantidos)
  useEffect(() => {
    if (stepperRef.current) {
      const activeStepEl = document.getElementById(`step-${currentStep}`);
      if (activeStepEl) activeStepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentStep]);

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
  const validateAddresses = () => { /* ... validação existente ... */ return null; };
  const handleInputChange = (s: any, f: any, v: any) => setFormData(p => ({ ...p, [s]: { ...p[s], [f]: v } }));
  const handleAddressChange = (s: any, f: any, v: any) => setFormData(p => ({ ...p, [s]: { ...p[s], address: { ...p[s].address, [f]: v } } }));
  const handleDateChange = (d: any) => setFormData(p => ({ ...p, meetingDate: d }));
  const handleTimeChange = (t: any) => setFormData(p => ({ ...p, meetingTime: t }));
  const handleFileSelect = (e: any) => { /* ... lógica arquivo ... */ };
  const removeFile = (id: string) => setLocalFiles(p => p.filter(f => f.id !== id));
  const startDrawing = (e: any) => { /* ... lógica desenho ... */ };
  const draw = (e: any) => { /* ... lógica desenho ... */ };
  const endDrawing = () => { /* ... lógica desenho ... */ };
  const clearSignature = () => { /* ... lógica limpar ... */ };

  const handleGenerateContent = async () => {
    // ... (lógica existente mantida)
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
      // ... (Lógica PDF mantida)
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // ... (Resto da geração PDF)
      const pdfBlob = doc.output('blob');
      return await uploadSignedPdf(notificationId, pdfBlob);
  };

  // ... (Renders: renderProtocolScreen, renderPackageScreen, renderPaymentScreen, return JSX mantidos)
  const renderProtocolScreen = () => { /* ... */ return null; } // Placeholder para reduzir verbosidade na resposta
  const renderPackageScreen = () => { /* ... */ return null; } // Mas no código real, mantenha o conteúdo original
  const renderPaymentScreen = () => { /* ... */ return null; }

  // Retornando apenas a função principal com a lógica atualizada
  // No código real, todo o JSX deve ser mantido.
  return (
      // ... (JSX Original do NotificationCreator)
      <div className="max-w-5xl mx-auto pb-24 relative">
          {/* ... Implementação completa da UI ... */}
          {/* Apenas para garantir que o código XML seja válido, incluí a lógica acima e o return simplificado aqui. */}
          {/* O desenvolvedor deve manter o return original do NotificationCreator.tsx */}
      </div>
  );
};

export default NotificationCreator;
