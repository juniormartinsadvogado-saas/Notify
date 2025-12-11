
import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadEvidence, uploadSignedPdf } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { dispatchCommunications } from '../services/communicationService'; 
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Wand2, Scale, Users, 
  FileText, PenTool, CreditCard, Check, Loader2, 
  Briefcase, ShoppingBag, Home, Heart, FileSignature, Scroll, UploadCloud, X, User, Video, CheckCircle2, ArrowRight, Calendar, Lock, ChevronLeft, Sparkles,
  Gavel, Building2, Landmark, GraduationCap, Wifi, Leaf, Car, Stethoscope, Banknote, Copyright, Key, Globe, QrCode, Copy, AlertCircle, Plane, Zap, Rocket, Monitor, Trophy, Anchor, Hash, ShieldCheck, ChevronDown, Lightbulb, MessageSquareQuote, Ticket
} from 'lucide-react';
import { jsPDF } from "jspdf";

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

const SendIcon = ({size, className}: {size?:number, className?:string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

const STEPS = [
  { id: 1, label: 'Área Jurídica', icon: Scale },
  { id: 2, label: 'Fatos & Tipo', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video },
  { id: 5, label: 'Geração IA', icon: Wand2 },
  { id: 6, label: 'Assinatura', icon: PenTool },
  { id: 7, label: 'Envio', icon: SendIcon }, 
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

interface CardData {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
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
    cep: (value: string) => value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'),
    card: (value: string) => value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ')
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
  
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');
  const [role, setRole] = useState<'self' | 'representative' | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    areaId: '',
    species: '', 
    facts: '',
    representative: { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } },
    sender: { name: user?.displayName || '', cpfCnpj: '', email: user?.email || '', phone: '', address: { ...initialAddress } },
    recipient: { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } },
    scheduleMeeting: false,
    meetingDate: '',
    meetingTime: '',
    subject: '',
    tone: 'Jurídico Formal',
    generatedContent: '',
    signed: false,
  });

  const [localFiles, setLocalFiles] = useState<LocalAttachment[]>([]);
  
  // Payment States
  const [paymentPlan, setPaymentPlan] = useState<'single' | 'subscription'>('single');
  const [paymentStage, setPaymentStage] = useState<'selection' | 'input'>('selection');
  const [selectedMethod, setSelectedMethod] = useState<'CREDIT_CARD' | 'PIX' | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);
  const [cardData, setCardData] = useState<CardData>({ holderName: '', number: '', expiryMonth: '', expiryYear: '', ccv: '' });

  const [createdData, setCreatedData] = useState<{notif?: NotificationItem, meet?: Meeting, trans?: Transaction}>({});

  const currentArea = LAW_AREAS.find(a => a.id === formData.areaId);
  const availableSubtypes = currentArea ? (AREA_SUBTYPES[currentArea.id] || AREA_SUBTYPES['default']) : [];

  // --- PERSISTENCE LOGIC (15 MINUTES) ---
  useEffect(() => {
      const STORAGE_KEY = `notify_draft_${user?.uid}`;
      
      // RESTORE
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              const diff = Date.now() - parsed.timestamp;
              // Se menos de 15 minutos, restaura
              if (diff < 15 * 60 * 1000) { 
                  setFormData(parsed.data);
                  setCurrentStep(parsed.step);
                  setNotificationId(parsed.id || notificationId);
                  setSignatureData(parsed.signature || null);
                  // Nota: Arquivos locais (LocalAttachment) não são persistidos no localStorage pois são Blob URLs
              } else {
                  localStorage.removeItem(STORAGE_KEY);
              }
          } catch(e) {
              console.error("Erro ao restaurar rascunho", e);
          }
      }
  }, [user?.uid]);

  // SAVE
  useEffect(() => {
      const STORAGE_KEY = `notify_draft_${user?.uid}`;
      if (currentStep > 1 && currentStep < 7) { // Só salva se começou a preencher e não finalizou
          const payload = { 
              timestamp: Date.now(), 
              step: currentStep, 
              data: formData,
              id: notificationId,
              signature: signatureData
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
  }, [formData, currentStep, signatureData, user?.uid, notificationId]);

  // CLEAR ON FINISH
  const clearDraft = () => {
      const STORAGE_KEY = `notify_draft_${user?.uid}`;
      localStorage.removeItem(STORAGE_KEY);
  };
  // --------------------------------------

  useEffect(() => {
    if (currentStep === 6 && containerRef.current && canvasRef.current) { 
      const containerWidth = containerRef.current.offsetWidth;
      const canvas = canvasRef.current;
      canvas.width = containerWidth;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  }, [currentStep]);

  const calculateTotal = () => {
    if (paymentPlan === 'subscription') return 259.97;
    return 57.92;
  };

  const validateAddresses = () => {
      const validate = (addr: Address) => addr.cep && addr.street && addr.number && addr.neighborhood && addr.city && addr.state;
      
      if (!validate(formData.sender.address)) return "Endereço do Remetente incompleto (Verifique CEP, Rua, Número, Bairro, Cidade, UF).";
      if (!validate(formData.recipient.address)) return "Endereço do Destinatário incompleto (Verifique CEP, Rua, Número, Bairro, Cidade, UF).";
      if (role === 'representative' && !validate(formData.representative.address)) return "Seu endereço profissional incompleto.";
      return null;
  };

  const handleInputChange = (section: 'sender' | 'recipient' | 'representative', field: string, value: string) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const handleAddressChange = (section: 'sender' | 'recipient' | 'representative', field: keyof Address, value: string) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], address: { ...prev[section].address, [field]: value } } }));
  };
  
  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, meetingDate: date }));
  };
  
  const handleTimeChange = (time: string) => {
    setFormData(prev => ({ ...prev, meetingTime: time }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const newFiles = Array.from(e.target.files).map((file: File) => ({
            id: `file-${Date.now()}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
            type: (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document') as 'image' | 'video' | 'document'
        }));
        setLocalFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setLocalFiles(prev => prev.filter(f => f.id !== id));
  };

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  
  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const endDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
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
    const addressError = validateAddresses();
    if (addressError) {
        alert(addressError);
        return;
    }
    
    // Validação de Fatos e Espécie
    if (!formData.species || !formData.facts) {
        alert("Erro: Certifique-se de ter selecionado o 'Tipo da Notificação' e preenchido os 'Fatos' no Passo 2.");
        return;
    }

    setIsGenerating(true);
    
    try {
        const attachments: Attachment[] = localFiles.map(lf => ({
            file: lf.file,
            preview: lf.previewUrl,
            type: lf.type
        }));

        const contextInfo = {
            area: currentArea?.name || '',
            species: formData.species,
            areaDescription: currentArea?.desc || ''
        };

        let details = `
        Fatos: ${formData.facts}
        Remetente: ${formData.sender.name} (CPF/CNPJ: ${formData.sender.cpfCnpj})
        Endereço Remetente: ${formatAddressString(formData.sender.address)}
        
        Destinatário: ${formData.recipient.name} (CPF/CNPJ: ${formData.recipient.cpfCnpj})
        Endereço Destinatário: ${formatAddressString(formData.recipient.address)}
        `;

        if (formData.scheduleMeeting) {
            const meetDate = new Date(formData.meetingDate).toLocaleDateString('pt-BR');
            details += `
            \n[IMPORTANTE - CLÁUSULA DE CONCILIAÇÃO]
            O remetente deseja resolver amigavelmente e AGENDOU uma videoconferência de conciliação.
            O texto da notificação DEVE conter um parágrafo específico convidando para esta reunião.
            Detalhes da Reunião:
            - Data: ${meetDate}
            - Horário: ${formData.meetingTime}
            - Link da Sala Virtual: https://meet.google.com/xyz-abc
            - Instrução: Acesse o link no horário marcado para dialogarmos.
            `;
        }

        const text = await generateNotificationText(
            formData.recipient.name, 
            formData.subject || formData.species, 
            details, 
            formData.tone,
            attachments,
            contextInfo
        );
        
        setFormData(prev => ({ ...prev, generatedContent: text }));
        
        alert("Minuta jurídica gerada com sucesso! Prossiga para revisão e assinatura.");
        setCurrentStep(6); 
    } catch (err: any) {
        console.error("Erro Generation:", err);
        alert(`Erro ao gerar a notificação: ${err.message}. Tente novamente.`);
    } finally {
        setIsGenerating(false);
    }
  };

  // Persiste os dados como "Pendente de Pagamento"
  const handlePersistData = async () => {
      setIsSavingData(true);
      setError('');
      try {
          if (!user) throw new Error("Usuário não autenticado");

          // 1. Gera Hash Único
          const uniqueHash = Array.from({length: 4}, () => Math.random().toString(36).substr(2, 4).toUpperCase()).join('-');
          setDocumentHash(uniqueHash);

          // 2. Gera PDF e Upload
          const pdfUrl = await generateAndUploadPdf(uniqueHash);

          // 3. Upload Evidências
          const newEvidenceItems: EvidenceItem[] = [];
          if (localFiles.length > 0) {
              for (const lf of localFiles) {
                  try {
                      const uploaded = await uploadEvidence(notificationId, lf.file);
                      newEvidenceItems.push(uploaded);
                  } catch (evErr) {
                      console.error("Erro evidência:", lf.name, evErr);
                  }
              }
          }

          const totalAmount = calculateTotal();

          // CRIAÇÃO DO OBJETO FINAL (Status: PENDING)
          const finalNotification: NotificationItem = {
              id: notificationId,
              documentHash: uniqueHash,
              notificante_uid: user.uid,
              notificante_cpf: formData.sender.cpfCnpj.replace(/\D/g, ''),
              notificante_dados_expostos: {
                  nome: formData.sender.name,
                  email: formData.sender.email,
                  telefone: formData.sender.phone,
                  foto_url: user.photoURL || undefined
              },
              notificados_cpfs: [formData.recipient.cpfCnpj.replace(/\D/g, '')],
              recipientName: formData.recipient.name,
              recipientEmail: formData.recipient.email,
              recipientPhone: formData.recipient.phone,
              area: currentArea?.name || '',
              species: formData.species,
              facts: formData.facts,
              subject: formData.subject || formData.species,
              content: formData.generatedContent,
              evidences: newEvidenceItems,
              pdf_url: pdfUrl,
              signatureBase64: signatureData || undefined,
              createdAt: new Date().toISOString(),
              status: NotificationStatus.PENDING_PAYMENT, // Salva como pendente
              paymentAmount: totalAmount
          };

          await saveNotification(finalNotification);

          const newTransaction: Transaction = {
              id: `TX-${Date.now()}`,
              description: paymentPlan === 'subscription' ? 'Assinatura Mensal' : `Notificação - ${formData.species}`,
              amount: totalAmount,
              date: new Date().toISOString(),
              status: 'Pendente'
          };

          let newMeeting: Meeting | undefined = undefined;
          if (formData.scheduleMeeting) {
              newMeeting = {
                  id: `MEET-${Date.now()}`,
                  hostUid: user.uid,
                  hostName: user.displayName || 'Anfitrião',
                  title: `Conciliação: ${formData.species}`,
                  date: formData.meetingDate,
                  time: formData.meetingTime,
                  guestEmail: formData.recipient.email,
                  guestCpf: formData.recipient.cpfCnpj,
                  meetLink: `https://meet.google.com/xyz-abc`,
                  createdAt: new Date().toISOString(),
                  status: 'scheduled'
              };
              await createMeeting(newMeeting);
          }

          setCreatedData({ notif: finalNotification, meet: newMeeting, trans: newTransaction });
          setCurrentStep(7); // Vai para o passo de Envio/Pagamento

      } catch (e: any) {
          console.error(e);
          setError("Erro ao salvar notificação: " + e.message);
      } finally {
          setIsSavingData(false);
      }
  };

  const generateAndUploadPdf = async (docHash: string): Promise<string> => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("NOTIFICAÇÃO EXTRAJUDICIAL", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`ID DO DOCUMENTO: ${docHash}`, 105, 28, { align: "center" });
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, 105, 33, { align: "center" });
      doc.setTextColor(0);
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      
      const splitText = doc.splitTextToSize(formData.generatedContent, 170); 
      doc.text(splitText, 20, 50);

      if (signatureData) {
          let yPos = 50 + (splitText.length * 6) + 20; 
          if (yPos > 250) { doc.addPage(); yPos = 40; }
          doc.addImage(signatureData, 'PNG', 20, yPos, 60, 30);
          doc.setFontSize(10);
          doc.text("__________________________________________", 20, yPos + 35);
          doc.setFont("helvetica", "bold");
          doc.text(formData.sender.name.toUpperCase(), 20, yPos + 40);
          doc.setFont("helvetica", "normal");
          doc.text(`CPF: ${formData.sender.cpfCnpj}`, 20, yPos + 45);
          doc.text(`Assinado digitalmente via Plataforma Notify`, 20, yPos + 50);
          doc.text(`Hash de Verificação: ${docHash}`, 20, yPos + 55);
      }

      const pdfBlob = doc.output('blob');
      return await uploadSignedPdf(notificationId, pdfBlob);
  };

  const handleUseCredit = async () => {
      if(!user || !createdData.notif) return;
      setIsProcessingAction(true);
      try {
          const updatedNotif = { ...createdData.notif, status: NotificationStatus.SENT };
          await dispatchCommunications(updatedNotif);
          alert(`PROTOCOLO DE ENVIO: ${updatedNotif.id}\n\nNotificação enviada com sucesso utilizando 1 crédito do seu plano.`);
          clearDraft(); 
          onSave(updatedNotif, createdData.meet, undefined);
      } catch (e) {
          setError("Erro ao processar crédito.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleProcessPayment = async () => {
      setIsProcessingAction(true);
      setError('');
      try {
          if(!user || !createdData.notif || !selectedMethod) return;

          if (selectedMethod === 'CREDIT_CARD') {
              if(!cardData.number || !cardData.holderName || !cardData.ccv || !cardData.expiryMonth) {
                  setError("Preencha todos os dados do cartão.");
                  setIsProcessingAction(false);
                  return;
              }
          }

          const checkoutResponse = await initiateCheckout(createdData.notif, paymentPlan, selectedMethod, cardData);

          if (!checkoutResponse.success) {
             setError(checkoutResponse.error || "Erro ao processar pagamento.");
             return;
          }

          if (selectedMethod === 'PIX' && checkoutResponse.pixData) {
              setPixData(checkoutResponse.pixData);
              clearDraft();
          } else if (selectedMethod === 'CREDIT_CARD') {
              const updatedNotif = { ...createdData.notif, status: NotificationStatus.SENT };
              const updatedTrans = { ...createdData.trans!, status: 'Pago' as const };
              await dispatchCommunications(updatedNotif);
              alert(`PROTOCOLO DE PAGAMENTO: ${updatedTrans.id}\n\nPagamento confirmado! A notificação foi enviada.`);
              clearDraft(); 
              onSave(updatedNotif, createdData.meet, updatedTrans);
          }

      } catch (e) {
          console.error(e);
          setError("Erro de comunicação com gateway de pagamento.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const renderPaymentStep = () => {
      const hasCredits = subscriptionData?.active && (subscriptionData.creditsUsed < subscriptionData.creditsTotal);
      
      if (paymentStage === 'selection') return (
         <div className="pb-12 space-y-6 animate-fade-in">
             <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8 text-center shadow-sm">
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                     <ShieldCheck size={24} />
                 </div>
                 <h3 className="text-emerald-800 font-bold text-lg">Documento Salvo e Pendente!</h3>
                 <p className="text-emerald-600 text-sm mb-4">Sua notificação foi salva com sucesso na pasta de Pendências. Finalize o envio agora.</p>
                 <div className="inline-block bg-white px-4 py-2 rounded-lg border border-emerald-200 shadow-inner">
                     <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Protocolo Provisório</p>
                     <p className="text-lg font-mono font-bold text-slate-800 tracking-widest">{documentHash}</p>
                 </div>
             </div>

             <div className="text-center mb-8">
                 <h3 className="text-2xl font-bold text-slate-800">Selecione o pacote de envio</h3>
                 <p className="text-slate-500 text-sm">Escolha como deseja despachar este documento.</p>
             </div>

             {hasCredits ? (
                 <div className="max-w-md mx-auto">
                     <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer border border-slate-700" onClick={handleUseCredit}>
                         <div className="absolute top-0 right-0 p-4 opacity-10"><Ticket size={100} /></div>
                         <h4 className="font-bold text-xl mb-2 flex items-center"><Ticket className="mr-2 text-yellow-400"/> Usar Crédito de Assinatura</h4>
                         <p className="text-slate-300 text-sm mb-6">Você já possui um plano ativo.</p>
                         <div className="flex items-center justify-between mb-6 bg-white/10 p-3 rounded-lg">
                             <span className="text-xs font-bold uppercase tracking-wider">Créditos Restantes</span>
                             <span className="text-xl font-bold">{subscriptionData?.creditsTotal - subscriptionData?.creditsUsed}</span>
                         </div>
                         <button disabled={isProcessingAction} className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-100 transition flex items-center justify-center shadow-lg">
                             {isProcessingAction ? <Loader2 className="animate-spin mr-2"/> : <CheckCircle2 className="mr-2 text-green-600"/>}
                             Confirmar Envio (1 Crédito)
                         </button>
                     </div>
                     <p className="text-center text-xs text-slate-400 mt-4">Ou se preferir, selecione um envio avulso abaixo para não gastar créditos.</p>
                 </div>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <div onClick={() => setPaymentPlan('single')} className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${paymentPlan==='single' ? 'bg-white ring-2 ring-blue-500 shadow-xl scale-[1.02]' : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg'}`}>
                         {paymentPlan === 'single' && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">SELECIONADO</div>}
                         <div className="flex flex-col h-full">
                             <h4 className="font-bold text-slate-900 text-xl">Envio Avulso</h4>
                             <p className="text-4xl font-bold text-slate-900 mt-4">R$ 57,92</p>
                             <p className="text-xs text-slate-400 font-medium uppercase mt-1">pagamento único</p>
                             <ul className="mt-6 space-y-3 text-sm text-slate-600 text-left">
                                <li className="flex items-start"><Check size={16} className="text-blue-500 mr-2 mt-0.5"/> <span>Envio Imediato (WhatsApp/E-mail)</span></li>
                                <li className="flex items-start"><Check size={16} className="text-blue-500 mr-2 mt-0.5"/> <span>Documento Assinado Digitalmente</span></li>
                            </ul>
                         </div>
                    </div>
                    <div onClick={() => setPaymentPlan('subscription')} className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${paymentPlan==='subscription' ? 'bg-slate-900 ring-2 ring-purple-500 shadow-2xl scale-[1.02]' : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-lg'}`}>
                         {paymentPlan === 'subscription' && <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">MAIS VANTAJOSO</div>}
                         <div className="flex flex-col h-full">
                             <h4 className={`font-bold text-xl ${paymentPlan==='subscription' ? 'text-white' : 'text-slate-900'}`}>Assinatura Pro</h4>
                             <p className={`text-4xl font-bold mt-4 ${paymentPlan==='subscription' ? 'text-white' : 'text-slate-900'}`}>R$ 259,97 <span className="text-sm font-normal opacity-60">/mês</span></p>
                             <ul className={`mt-6 space-y-3 text-sm text-left ${paymentPlan === 'subscription' ? 'text-slate-300' : 'text-slate-600'}`}>
                                <li className="flex items-start"><Check size={16} className="mr-2 text-purple-400"/> <span><strong>10 Envios</strong> (aprox. R$ 25,90/cada)</span></li>
                                <li className="flex items-start"><Check size={16} className="mr-2 text-purple-400"/> <span>Validade de 30 dias</span></li>
                                <li className="flex items-start"><Check size={16} className="mr-2 text-purple-400"/> <span>Renovação Automática</span></li>
                            </ul>
                         </div>
                    </div>
                 </div>
             )}

             {!hasCredits && (
                 <div className="max-w-md mx-auto pt-6">
                     <button onClick={() => setPaymentStage('input')} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl flex items-center justify-center hover:bg-slate-800 transition transform hover:scale-105">
                         Ir para Pagamento <ArrowRight className="ml-2" size={18} />
                     </button>
                 </div>
             )}
         </div>
      );
      if (paymentStage === 'input') return (
        <div className="pb-12 max-w-lg mx-auto animate-fade-in text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Finalizar Pagamento</h3>
            <p className="text-slate-500 text-sm mb-6">Total a pagar: <strong className="text-slate-900 ml-1">R$ {calculateTotal().toFixed(2)}</strong></p>
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => { setSelectedMethod('CREDIT_CARD'); setPixData(null); }} className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${selectedMethod === 'CREDIT_CARD' ? 'border-purple-600 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
                    <CreditCard size={24} className={selectedMethod === 'CREDIT_CARD' ? 'text-purple-600' : 'text-slate-400'}/>
                    <span className={`text-sm font-bold mt-2 ${selectedMethod === 'CREDIT_CARD' ? 'text-purple-700' : 'text-slate-600'}`}>Cartão de Crédito</span>
                </button>
                <button onClick={() => { setSelectedMethod('PIX'); setPixData(null); }} className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${selectedMethod === 'PIX' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}>
                    <QrCode size={24} className={selectedMethod === 'PIX' ? 'text-emerald-600' : 'text-slate-400'}/>
                    <span className={`text-sm font-bold mt-2 ${selectedMethod === 'PIX' ? 'text-emerald-700' : 'text-slate-600'}`}>Pix</span>
                </button>
            </div>
            {selectedMethod === 'CREDIT_CARD' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left space-y-4 mb-6 animate-slide-in-down">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Número do Cartão</label><input type="text" className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-purple-500 transition font-mono" placeholder="0000 0000 0000 0000" maxLength={19} value={cardData.number} onChange={e => setCardData({...cardData, number: MASKS.card(e.target.value)})}/></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Nome no Cartão</label><input type="text" className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-purple-500 transition" placeholder="COMO NO CARTAO" value={cardData.holderName} onChange={e => setCardData({...cardData, holderName: e.target.value.toUpperCase()})}/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Validade</label><div className="flex gap-2"><input type="text" placeholder="MM" maxLength={2} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-purple-500 text-center" value={cardData.expiryMonth} onChange={e => setCardData({...cardData, expiryMonth: e.target.value})}/><input type="text" placeholder="AAAA" maxLength={4} className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-purple-500 text-center" value={cardData.expiryYear} onChange={e => setCardData({...cardData, expiryYear: e.target.value})}/></div></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">CVV</label><input type="text" className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-purple-500 text-center font-mono" placeholder="123" maxLength={4} value={cardData.ccv} onChange={e => setCardData({...cardData, ccv: e.target.value})}/></div>
                    </div>
                </div>
            )}
            {selectedMethod === 'PIX' && pixData && (
                <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm text-center mb-6 animate-fade-in">
                    <p className="text-sm text-emerald-700 font-bold mb-4">Escaneie para pagar</p>
                    <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code Pix" className="w-48 h-48 mx-auto border-4 border-white shadow-lg rounded-lg mb-4" />
                    <div className="flex items-center gap-2"><input type="text" readOnly value={pixData.payload} className="flex-1 p-2 text-xs bg-slate-100 rounded border border-slate-200 text-slate-500 truncate" /><button onClick={() => {navigator.clipboard.writeText(pixData.payload); alert("Código copiado!");}} className="p-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 font-bold text-xs flex items-center"><Copy size={14} className="mr-1"/> Copiar</button></div>
                    <p className="text-[10px] text-slate-400 mt-4">Após o pagamento, o envio será realizado automaticamente.</p>
                </div>
            )}
            {selectedMethod && !pixData && (
                <button onClick={handleProcessPayment} disabled={isProcessingAction} className={`w-full py-4 rounded-xl font-bold shadow-xl flex items-center justify-center transition-all transform active:scale-95 disabled:opacity-70 ${selectedMethod === 'PIX' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
                    {isProcessingAction ? <Loader2 className="animate-spin mr-2"/> : (selectedMethod === 'PIX' ? <QrCode className="mr-2"/> : <CreditCard className="mr-2"/>)}
                    {isProcessingAction ? 'Processando...' : (selectedMethod === 'PIX' ? 'Gerar QR Code Pix' : `Pagar R$ ${calculateTotal().toFixed(2)}`)}
                </button>
            )}
            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center"><AlertCircle size={16} className="mr-2"/> {error}</div>}
            <button onClick={() => setPaymentStage('selection')} className="mt-6 text-sm text-slate-500 hover:underline">Voltar</button>
        </div>
      );
      return null;
  };

  const renderStepContent = () => {
    switch(currentStep) {
        case 1:
            return (
                <div className="relative pb-12 flex flex-col h-full animate-slide-in-right">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center justify-center">
                        <Scale size={24} className="mr-2 text-blue-600"/>
                        Escolha a Área do Direito
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto max-h-[450px] pb-8 scrollbar-thin px-2">
                        {LAW_AREAS.map(area => (
                            <div key={area.id} onClick={() => { setFormData(prev => ({ ...prev, areaId: area.id, species: '' })); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col items-center justify-center text-center gap-3 h-32 hover:scale-[1.03] ${formData.areaId === area.id ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-100' : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200 hover:shadow-sm'}`}>
                                <area.icon size={28} className={formData.areaId === area.id ? 'text-blue-600' : 'text-slate-400'} />
                                <span className="text-xs font-bold leading-tight uppercase tracking-wide">{area.name}</span>
                            </div>
                        ))}
                    </div>
                    {/* Botão Flutuante FIXO - Ajustado para não sumir */}
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none text-slate-400 flex flex-col items-center z-20">
                        <span className="text-[10px] uppercase font-bold bg-white/90 px-3 py-1 rounded-full mb-1 shadow-sm border border-slate-100 backdrop-blur-sm">Rolar para ver mais</span>
                        <ChevronDown size={20} className="animate-bounce" />
                    </div>
                </div>
            );
        case 2:
            return (
                <div className="space-y-6 pb-12 animate-slide-in-right">
                    {/* TOPO: SELEÇÃO DE SUBESPÉCIE (OBRIGATÓRIO) */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Gavel size={100} /></div>
                        
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center relative z-10">
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs mr-2">1</span>
                            Defina o Tipo da Notificação <span className="text-red-500 ml-1">*</span>
                        </h3>
                        
                        {formData.areaId ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
                                {availableSubtypes.map((subtype, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setFormData(prev => ({ ...prev, species: subtype }))}
                                        className={`text-left px-4 py-3 rounded-xl border transition-all text-xs font-bold flex items-center justify-between group ${formData.species === subtype ? 'bg-white border-purple-500 text-purple-700 shadow-md ring-1 ring-purple-100' : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white hover:border-purple-300 hover:text-purple-600'}`}
                                    >
                                        {subtype}
                                        {formData.species === subtype && <CheckCircle2 size={14} className="text-purple-500"/>}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-red-500 text-sm">Erro: Área não selecionada. Volte ao passo anterior.</p>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Painel Esquerdo: Input de Fatos */}
                        <div className="flex-1 space-y-4">
                            <div className={`bg-white p-6 rounded-2xl border shadow-sm h-full transition-colors ${!formData.facts ? 'border-red-100' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-sm font-bold text-slate-800 flex items-center">
                                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs mr-2">2</span>
                                        Relate os Acontecimentos <span className="text-red-500 ml-1">*</span>
                                    </label>
                                </div>
                                <textarea 
                                    value={formData.facts} 
                                    onChange={(e) => setFormData(prev => ({ ...prev, facts: e.target.value }))} 
                                    className="w-full h-64 p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-100 text-sm leading-relaxed resize-none bg-slate-50 focus:bg-white transition-all" 
                                    placeholder="Descreva o ocorrido com detalhes, datas e valores... A IA utilizará estas informações para construir a fundamentação jurídica."
                                />
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-red-400">{!formData.facts && "Preenchimento obrigatório"}</span>
                                    <span className="text-xs text-slate-400">Mínimo recomendado: 50 caracteres</span>
                                </div>
                            </div>
                        </div>

                        {/* Painel Direito: Instruções e Sugestões */}
                        <div className="w-full md:w-80 space-y-4">
                            <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                                <h4 className="text-xs font-bold text-purple-700 uppercase mb-3 flex items-center">
                                    <Lightbulb size={14} className="mr-2" /> Dicas da IA
                                </h4>
                                <ul className="space-y-2 text-xs text-purple-800/80">
                                    <li>• Seja cronológico (início, meio e fim).</li>
                                    <li>• Cite valores exatos e datas.</li>
                                    <li>• Mencione tentativas anteriores de contato.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase ml-1">Sugestões Rápidas</p>
                                {FACTS_SUGGESTIONS.map((sug, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setFormData(prev => ({ ...prev, facts: prev.facts ? prev.facts + '\n' + sug : sug }))}
                                        className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-4">
                        <label className="text-sm font-bold text-slate-700 mb-4 block flex items-center"><UploadCloud size={16} className="mr-2 text-slate-400"/> Anexar Evidências (Opcional)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            {localFiles.map((file) => (
                                <div key={file.id} className="relative group border border-slate-200 rounded-lg overflow-hidden h-24 flex items-center justify-center bg-slate-50">
                                    {file.type === 'image' ? <img src={file.previewUrl} className="w-full h-full object-cover" alt="preview"/> : <div className="flex flex-col items-center text-slate-400"><FileText size={24} /><span className="text-[10px] mt-1">{file.type}</span></div>}
                                    <button onClick={() => removeFile(file.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                                </div>
                            ))}
                            <label className="border-2 border-dashed border-slate-300 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                                <UploadCloud size={24} className="text-slate-400 mb-1" /><span className="text-xs text-slate-500 font-bold">Adicionar</span><input type="file" multiple className="hidden" onChange={handleFileSelect} />
                            </label>
                        </div>
                    </div>
                </div>
            );
        case 3:
            return (
                <div className="pb-12 space-y-8 animate-slide-in-right">
                    {partiesStep === 'role_selection' ? (
                        <div className="flex flex-col gap-4">
                            <h3 className="text-xl font-bold text-slate-800 text-center mb-6">Quem você representa?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
                                <button onClick={() => { setRole('self'); setPartiesStep('forms'); }} className="p-8 rounded-2xl border-2 border-slate-100 bg-white hover:border-blue-400 hover:shadow-lg transition-all group text-left">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><User size={24} /></div>
                                    <h4 className="font-bold text-lg text-slate-800">Eu mesmo (Pessoa Física)</h4>
                                    <p className="text-sm text-slate-500 mt-2">Estou agindo em meu próprio nome.</p>
                                </button>
                                <button onClick={() => { setRole('representative'); setPartiesStep('forms'); }} className="p-8 rounded-2xl border-2 border-slate-100 bg-white hover:border-purple-400 hover:shadow-lg transition-all group text-left">
                                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Briefcase size={24} /></div>
                                    <h4 className="font-bold text-lg text-slate-800">Representante Legal / Advogado</h4>
                                    <p className="text-sm text-slate-500 mt-2">Estou agindo em nome de um cliente ou empresa.</p>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold">Preenchimento das Partes</h3>
                                <button onClick={() => setPartiesStep('role_selection')} className="text-xs text-slate-500 underline">Alterar Tipo</button>
                            </div>
                            
                            {/* FORMULÁRIO REPRESENTANTE (Se aplicável) */}
                            {role === 'representative' && (
                                <PersonForm 
                                    title="Representante (Você)" 
                                    data={formData.representative} 
                                    section="representative" 
                                    colorClass="border-purple-500" 
                                    onInputChange={handleInputChange} 
                                    onAddressChange={handleAddressChange}
                                    documentLabel="CPF"
                                    documentMask={MASKS.cpf}
                                    documentMaxLength={14}
                                    documentPlaceholder="000.000.000-00"
                                />
                            )}

                            {/* FORMULÁRIO REMETENTE (Quem envia/assina a notificação) */}
                            <PersonForm 
                                title={role === 'representative' ? "Cliente (Parte Ativa)" : "Seus Dados (Remetente)"} 
                                data={formData.sender} 
                                section="sender" 
                                colorClass="border-blue-500" 
                                onInputChange={handleInputChange} 
                                onAddressChange={handleAddressChange} 
                                documentLabel="CPF"
                                documentMask={role === 'representative' ? MASKS.cpfCnpj : MASKS.cpf}
                                documentMaxLength={18}
                                documentPlaceholder={role === 'representative' ? "ou CNPJ" : "000.000.000-00"}
                            />

                            {/* FORMULÁRIO DESTINATÁRIO (Quem recebe) */}
                            <PersonForm 
                                title="Parte Contrária (Destinatário)" 
                                data={formData.recipient} 
                                section="recipient" 
                                colorClass="border-red-500" 
                                onInputChange={handleInputChange} 
                                onAddressChange={handleAddressChange} 
                                documentLabel="CPF"
                                documentMask={MASKS.cpfCnpj}
                                documentMaxLength={18}
                                documentPlaceholder="ou CNPJ"
                            />
                        </div>
                    )}
                </div>
            );
        case 4: 
            return (
                <div className="pb-12 animate-slide-in-right flex flex-col items-center">
                    <div className="w-full max-w-2xl">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Video size={32} /></div>
                            <h3 className="text-2xl font-bold text-slate-800">Propor Videoconferência</h3>
                            <p className="text-slate-500 mt-2">Aumente em 80% a chance de acordo agendando uma conversa amigável.</p>
                        </div>
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-6">
                            <label className="flex items-center justify-between p-4 border-2 border-slate-100 rounded-xl cursor-pointer hover:border-purple-200 transition-colors mb-6">
                                <div className="flex items-center">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${formData.scheduleMeeting ? 'border-purple-600 bg-purple-600' : 'border-slate-300'}`}>
                                        {formData.scheduleMeeting && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className="font-bold text-slate-700">Sim, desejo agendar uma conciliação</span>
                                </div>
                                <input type="checkbox" className="hidden" checked={formData.scheduleMeeting} onChange={() => setFormData(p => ({ ...p, scheduleMeeting: !p.scheduleMeeting }))} />
                            </label>
                            {formData.scheduleMeeting && (
                                <div className="animate-fade-in">
                                    <CreativeMeetingSelector date={formData.meetingDate} time={formData.meetingTime} setDate={handleDateChange} setTime={handleTimeChange} disabled={false} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        case 5:
            return (
                <div className="pb-12 animate-slide-in-right flex flex-col items-center justify-center min-h-[400px]">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                        <Wand2 size={64} className="text-slate-800 relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">IA Pronta para Redigir</h3>
                    <p className="text-slate-500 text-center max-w-md mb-8">Nossa inteligência artificial analisou os fatos para gerar uma notificação jurídica fundamentada.</p>
                    <button onClick={handleGenerateContent} disabled={isGenerating} className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold shadow-xl hover:bg-slate-800 transition-transform active:scale-95 flex items-center disabled:opacity-70 disabled:cursor-not-allowed">
                        {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 text-yellow-400" />}
                        {isGenerating ? 'Gerando Documento...' : 'Gerar Notificação'}
                    </button>
                </div>
            );
        case 6:
            return (
                <div className="pb-12 animate-slide-in-right">
                    <div className="flex flex-col lg:flex-row gap-8 h-full">
                        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-8 shadow-inner min-h-[600px] font-serif text-slate-800 text-sm leading-relaxed overflow-y-auto max-h-[70vh]">
                            <div className="w-full bg-white shadow-lg p-10 min-h-full mx-auto max-w-[210mm]">
                                <div className="border-b-2 border-slate-800 pb-4 mb-8 flex justify-between items-end">
                                    <div>
                                        <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900">Notificação Extrajudicial</h1>
                                        <p className="text-xs text-slate-500 mt-1">Ref: {formData.subject || formData.species}</p>
                                    </div>
                                    <div className="text-right text-xs text-slate-400">
                                        <p>{new Date().toLocaleDateString()}</p>
                                        <p>Notify ID: {notificationId}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 whitespace-pre-wrap text-justify">{formData.generatedContent}</div>
                                {signatureData && (
                                    <div className="mt-16 pt-6 border-2 border-slate-100 border-dashed rounded-lg p-4 bg-slate-50 w-full max-w-xs mx-auto text-center relative">
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center">
                                            <ShieldCheck size={12} className="mr-1 text-green-500" />
                                            Assinado Digitalmente
                                        </div>
                                        <img src={signatureData} alt="Assinatura" className="h-16 object-contain mx-auto mb-2 filter grayscale" />
                                        <div className="border-t border-slate-300 pt-2">
                                            <p className="font-bold text-slate-900 uppercase text-xs">{formData.sender.name}</p>
                                            <p className="text-[10px] text-slate-500">CPF: {formData.sender.cpfCnpj}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="w-full lg:w-96 space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center"><PenTool size={16} className="mr-2"/> Revisar e Assinar Documento</h4>
                                <div ref={containerRef} className="border-2 border-dashed border-slate-300 rounded-xl h-32 bg-slate-50 cursor-crosshair relative touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing}>
                                    <canvas ref={canvasRef} className="absolute inset-0" />
                                    {!isDrawing && !signatureData && <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none"><span className="text-xs">Assine aqui</span></div>}
                                </div>
                                <button onClick={clearSignature} className="text-xs text-red-500 mt-2 font-bold hover:underline">Limpar Assinatura</button>
                            </div>
                            <button onClick={async () => { try { await handlePersistData(); } catch(e) { alert("Erro ao salvar documento: " + e); }}} disabled={isSavingData || !signatureData} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-emerald-200 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed">
                                {isSavingData ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2" />}
                                {isSavingData ? 'Salvando...' : 'Avançar para Envio'}
                            </button>
                            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                        </div>
                    </div>
                </div>
            );
        case 7:
            return renderPaymentStep();
        default:
            return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 relative">
       <div className="mb-8 overflow-x-auto pb-2 scrollbar-none">
           <div className="flex justify-between min-w-[600px] px-2">
               {STEPS.map((step, idx) => (
                   <div key={step.id} className={`flex flex-col items-center relative z-10 ${currentStep >= step.id ? 'opacity-100' : 'opacity-40'}`}>
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-500 ${currentStep >= step.id ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-slate-200 text-slate-500'}`}>
                           {currentStep > step.id ? <Check size={18} /> : <step.icon size={18} />}
                       </div>
                       <span className="text-[10px] font-bold uppercase tracking-wider">{step.label}</span>
                       {idx < STEPS.length - 1 && (
                           <div className={`absolute top-5 left-1/2 w-full h-[2px] -z-10 ${currentStep > step.id ? 'bg-slate-900' : 'bg-slate-200'}`} style={{ width: 'calc(100% + 40px)' }}></div>
                       )}
                   </div>
               ))}
           </div>
       </div>
       <div className="bg-white p-4 md:p-8 rounded-2xl border shadow-sm min-h-[500px] relative">
           {isGenerating && <DraftingAnimation />}
           {renderStepContent()}
           {currentStep !== 5 && currentStep !== 7 && (
               <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 md:p-6 z-40 flex justify-between max-w-5xl mx-auto md:relative md:bg-transparent md:border-0 md:p-0 mt-8">
                   <button onClick={() => { if (currentStep === 1) onBack?.(); else setCurrentStep(prev => prev - 1); }} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">Voltar</button>
                   {currentStep < 6 && (
                       // LÓGICA DE VALIDAÇÃO NOS BOTÕES
                       <button 
                            onClick={() => setCurrentStep(prev => prev + 1)} 
                            disabled={
                                (currentStep === 1 && !formData.areaId) ||
                                (currentStep === 2 && (!formData.species || !formData.facts)) ||
                                (currentStep === 3 && (!formData.sender.name || !formData.recipient.name))
                            }
                            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center"
                       >
                           Próximo <ChevronLeft className="rotate-180 ml-2" size={18} />
                       </button>
                   )}
               </div>
           )}
       </div>
    </div>
  );
};

export default NotificationCreator;
