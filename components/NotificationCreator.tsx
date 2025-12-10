
import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadEvidence, uploadSignedPdf } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Wand2, Scale, Users, 
  FileText, PenTool, CreditCard, Check, Loader2, 
  Briefcase, ShoppingBag, Home, Heart, FileSignature, Scroll, UploadCloud, X, User, Video, CheckCircle2, ArrowRight, Calendar, Lock, ChevronLeft, Sparkles,
  Gavel, Building2, Landmark, GraduationCap, Wifi, Leaf, Car, Stethoscope, Banknote, Copyright, Key, Globe, QrCode
} from 'lucide-react';

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
  onBack?: () => void;
}

// --- FLUXO REORDENADO ---
const STEPS = [
  { id: 1, label: 'Áreas', icon: Scale },
  { id: 2, label: 'Ocorrências', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video }, // NOVO PASSO ANTES DA IA
  { id: 5, label: 'Geração IA', icon: Wand2 },
  { id: 6, label: 'Assinatura', icon: PenTool },
  { id: 7, label: 'Pagamento', icon: CreditCard },
];

// --- 20 ÁREAS DO DIREITO ---
const LAW_AREAS = [
  { 
    id: 'civil', name: 'Civil', icon: Scale, desc: 'Relações privadas, obrigações e responsabilidade civil.',
    species: ['Cobrança de dívidas', 'Indenização por danos morais', 'Indenização por danos materiais', 'Cumprimento de obrigação', 'Notificação extrajudicial genérica']
  },
  { 
    id: 'trabalhista', name: 'Trabalhista', icon: Briefcase, desc: 'Relações de trabalho e emprego.',
    species: ['Pagamento de verbas rescisórias', 'Assédio moral no trabalho', 'Reintegração de emprego', 'Solicitação de documentos', 'Justificativa de faltas']
  },
  { 
    id: 'consumidor', name: 'Consumidor', icon: ShoppingBag, desc: 'Defesa de quem adquire produtos/serviços.',
    species: ['Produto com defeito', 'Cobrança indevida', 'Falha na prestação de serviço', 'Cancelamento de contrato', 'Publicidade enganosa']
  },
  { 
    id: 'imobiliario', name: 'Imobiliário', icon: Home, desc: 'Posse, propriedade e locação.',
    species: ['Atraso no aluguel', 'Pedido de desocupação', 'Vícios no imóvel', 'Devolução de caução', 'Perturbação do sossego']
  },
  { 
    id: 'familia', name: 'Família', icon: Heart, desc: 'Relações familiares e sucessões.',
    species: ['Pagamento de pensão alimentícia', 'Regulamentação de visitas', 'Alienação parental', 'Pedido de divórcio consensual', 'Partilha de bens']
  },
  { 
    id: 'contratual', name: 'Contratual', icon: FileSignature, desc: 'Acordos firmados entre partes.',
    species: ['Descumprimento de cláusula', 'Rescisão contratual', 'Aplicação de multa', 'Revisão de contrato', 'Distrato']
  },
  { 
    id: 'criminal', name: 'Criminal', icon: Gavel, desc: 'Crimes contra honra e notificações penais.',
    species: ['Calúnia, Injúria ou Difamação', 'Notificação para cessar ameaças', 'Pedido de explicações em juízo', 'Stalking/Perseguição']
  },
  { 
    id: 'empresarial', name: 'Empresarial', icon: Building2, desc: 'Atividades empresariais e societárias.',
    species: ['Dissolução de sociedade', 'Prestação de contas', 'Cobrança entre empresas', 'Uso indevido de marca', 'Concorrência desleal']
  },
  { 
    id: 'tributario', name: 'Tributário', icon: Landmark, desc: 'Impostos, taxas e fisco.',
    species: ['Defesa administrativa', 'Pedido de isenção', 'Restituição de imposto', 'Parcelamento de dívida']
  },
  { 
    id: 'bancario', name: 'Bancário', icon: Banknote, desc: 'Relações com instituições financeiras.',
    species: ['Juros abusivos', 'Fraude em empréstimo', 'Cartão não solicitado', 'Negativação indevida', 'Renegociação de dívida']
  },
  { 
    id: 'condominial', name: 'Condominial', icon: Key, desc: 'Vida em condomínio e vizinhança.',
    species: ['Multa por barulho', 'Inadimplência de condomínio', 'Uso indevido de área comum', 'Danos causados por vizinho', 'Obras irregulares']
  },
  { 
    id: 'digital', name: 'Direito Digital', icon: Wifi, desc: 'Internet, dados e crimes virtuais.',
    species: ['Remoção de conteúdo ofensivo', 'Uso indevido de imagem', 'Vazamento de dados (LGPD)', 'Recuperação de conta', 'Golpes virtuais']
  },
  { 
    id: 'administrativo', name: 'Administrativo', icon: Scroll, desc: 'Relações com órgãos públicos.',
    species: ['Recurso de multa', 'Solicitação de prontuário', 'Pedido de licença', 'Impugnação de edital']
  },
  { 
    id: 'previdenciario', name: 'Previdenciário', icon: GraduationCap, desc: 'Aposentadoria e INSS.',
    species: ['Pedido de benefício', 'Recurso administrativo INSS', 'Revisão de aposentadoria', 'Declaração de tempo de serviço']
  },
  { 
    id: 'transito', name: 'Trânsito', icon: Car, desc: 'Veículos e infrações.',
    species: ['Recurso de multa de trânsito', 'Transferência de veículo não realizada', 'Acidente de trânsito (Danos)', 'CNH suspensa']
  },
  { 
    id: 'medico', name: 'Médico', icon: Stethoscope, desc: 'Saúde e erro médico.',
    species: ['Negativa de plano de saúde', 'Erro médico/odontológico', 'Reembolso de despesas', 'Fornecimento de medicamento']
  },
  { 
    id: 'ambiental', name: 'Ambiental', icon: Leaf, desc: 'Meio ambiente e sustentabilidade.',
    species: ['Defesa de multa ambiental', 'Denúncia de dano ambiental', 'Regularização de licença', 'Poda de árvore ilegal']
  },
  { 
    id: 'propriedade_intelectual', name: 'Prop. Intelectual', icon: Copyright, desc: 'Direitos autorais e marcas.',
    species: ['Notificação de uso de imagem', 'Plágio', 'Violação de direitos autorais', 'Uso de software pirata']
  },
  { 
    id: 'agrario', name: 'Agrário', icon: Leaf, desc: 'Relações no campo e terras.',
    species: ['Arrendamento rural', 'Invasão de terras', 'Contratos de safra', 'Demarcação de terras']
  },
  { 
    id: 'internacional', name: 'Internacional', icon: Globe, desc: 'Relações estrangeiras.',
    species: ['Homologação de sentença', 'Contratos internacionais', 'Vistos e imigração', 'Extradição']
  }
];

// ... (Restante das interfaces e helpers mantidos iguais) ...
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

// --- Helper Functions ---
const MASKS = {
    cpf: (value: string) => {
        return value.replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
            .substring(0, 14); 
    },
    cpfCnpj: (value: string) => {
      const v = value.replace(/\D/g, '');
      if (v.length <= 11) {
        return v.replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      }
      return v.replace(/^(\d{2})(\d)/, '$1.$2')
              .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
              .replace(/\.(\d{3})(\d)/, '.$1/$2')
              .replace(/(\d{4})(\d)/, '$1-$2');
    },
    phone: (value: string) => {
      const v = value.replace(/\D/g, '');
      return v.replace(/^(\d{2})(\d)/, '($1) $2')
              .replace(/(\d)(\d{4})$/, '$1-$2');
    },
    cep: (value: string) => {
      return value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2');
    }
};

const formatAddressString = (addr: Address) => {
    const parts = [];
    if(addr.street) parts.push(addr.street);
    if(addr.number) parts.push(addr.number);
    if(addr.complement) parts.push(addr.complement);
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
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <input type="text" value={data.name} onChange={e => onInputChange(section, 'name', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="Nome" />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{documentLabel}</label>
                    <input type="text" value={data.cpfCnpj} maxLength={documentMaxLength} onChange={e => onInputChange(section, 'cpfCnpj', documentMask(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder={documentPlaceholder} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                    <input type="email" value={data.email} onChange={e => onInputChange(section, 'email', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="email@exemplo.com" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone / WhatsApp</label>
                    <input type="text" value={data.phone} maxLength={15} onChange={e => onInputChange(section, 'phone', MASKS.phone(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="(00) 00000-0000" />
                 </div>
             </div>

             <div className="mt-6 pt-4 border-t border-slate-100">
                 <span className="text-xs font-bold text-slate-400 uppercase block mb-3">Endereço (Opcional)</span>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" placeholder="CEP" value={data.address.cep} onChange={e => onAddressChange(section, 'cep', MASKS.cep(e.target.value))} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <input type="text" placeholder="Rua" value={data.address.street} onChange={e => onAddressChange(section, 'street', e.target.value)} className="col-span-1 md:col-span-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <input type="text" placeholder="Número" value={data.address.number} onChange={e => onAddressChange(section, 'number', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <input type="text" placeholder="Bairro" value={data.address.neighborhood} onChange={e => onAddressChange(section, 'neighborhood', e.target.value)} className="col-span-1 md:col-span-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <input type="text" placeholder="Cidade" value={data.address.city} onChange={e => onAddressChange(section, 'city', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <input type="text" placeholder="UF" value={data.address.state} maxLength={2} onChange={e => onAddressChange(section, 'state', e.target.value.toUpperCase())} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                 </div>
             </div>
        </div>
    );
};

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user, onBack }) => {
  // ... (Estados iniciais mantidos) ...
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [error, setError] = useState('');
  const [notificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');
  const [role, setRole] = useState<'self' | 'representative' | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
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
  
  const [paymentPlan, setPaymentPlan] = useState<'single' | 'subscription'>('single');
  const [paymentStage, setPaymentStage] = useState<'selection' | 'input' | 'protocol'>('selection');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [createdData, setCreatedData] = useState<{notif?: NotificationItem, meet?: Meeting, trans?: Transaction}>({});

  const currentArea = LAW_AREAS.find(a => a.id === formData.areaId);

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
    return 57.92; // Avulso
  };

  // ... (Funções de input, endereço, data, arquivo e assinatura mantidas iguais) ...
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

  // ... (handleGenerateContent e handlePersistData mantidos iguais) ...
  const handleGenerateContent = async () => {
    if (!formData.species || !formData.facts) return;
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
        setCurrentStep(6); 
    } catch (err) {
        console.error(err);
        alert("Erro ao gerar conteúdo. Tente novamente.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePersistData = async () => {
      setIsSavingData(true);
      setError('');
      try {
          if (!user) throw new Error("Usuário não autenticado");

          const pdfBlob = new Blob([formData.generatedContent], { type: 'application/pdf' }); 
          const pdfUrl = await uploadSignedPdf(notificationId, pdfBlob);

          const newEvidenceItems: EvidenceItem[] = [];
          if (localFiles.length > 0) {
              for (const lf of localFiles) {
                  const uploaded = await uploadEvidence(notificationId, lf.file);
                  newEvidenceItems.push(uploaded);
              }
          }

          const totalAmount = calculateTotal();

          const finalNotification: NotificationItem = {
              id: notificationId,
              senderUid: user.uid,
              senderName: formData.sender.name,
              senderEmail: formData.sender.email,
              senderPhotoUrl: user.photoURL || undefined,
              recipientName: formData.recipient.name,
              recipientEmail: formData.recipient.email,
              recipientPhone: formData.recipient.phone,
              recipientCpf: formData.recipient.cpfCnpj.replace(/\D/g, ''),
              area: currentArea?.name || '',
              species: formData.species,
              facts: formData.facts,
              subject: formData.subject || formData.species,
              content: formData.generatedContent,
              evidences: newEvidenceItems,
              pdfUrl: pdfUrl,
              signatureBase64: signatureData || undefined,
              createdAt: new Date().toISOString(),
              status: NotificationStatus.PENDING_PAYMENT,
              paymentMethod: 'credit_card', 
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

      } catch (e: any) {
          console.error(e);
          setError("Erro ao salvar dados: " + e.message);
          throw e;
      } finally {
          setIsSavingData(false);
      }
  };

  const handleConfirmPayment = async (method: 'CREDIT_CARD' | 'PIX') => {
      setIsProcessingAction(true);
      setError('');
      
      try {
          if(!user || !createdData.notif) return;

          const checkoutResponse = await initiateCheckout(createdData.notif, paymentPlan, method);

          if (!checkoutResponse.success) {
             setError(checkoutResponse.error || "Erro ao iniciar pagamento. Tente novamente.");
             return;
          }

          if (checkoutResponse.checkoutUrl) {
             window.location.assign(checkoutResponse.checkoutUrl);
             return;
          }

      } catch (e) {
          console.error(e);
          setError("Erro ao processar redirecionamento de pagamento.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const renderPaymentStep = () => {
      if (paymentStage === 'selection') return (
         <div className="pb-12 space-y-6 animate-fade-in">
             <div className="text-center mb-8">
                 <h3 className="text-2xl font-bold text-slate-800">Escolha como prosseguir</h3>
                 <p className="text-slate-500 text-sm">Selecione o plano ideal.</p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div onClick={() => setPaymentPlan('single')} className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${paymentPlan==='single' ? 'bg-white ring-2 ring-blue-500 shadow-xl scale-[1.02]' : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg'}`}>
                     {paymentPlan === 'single' && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">SELECIONADO</div>}
                     <div className="flex flex-col h-full">
                         <h4 className="font-bold text-slate-900 text-xl">Envio Avulso</h4>
                         <p className="text-4xl font-bold text-slate-900 mt-4">R$ 57,92</p>
                         <p className="text-xs text-slate-400 font-medium uppercase mt-1">pagamento único</p>
                         
                         <ul className="mt-6 space-y-3 text-sm text-slate-600 text-left">
                            <li className="flex items-start"><Check size={16} className="text-blue-500 mr-2 mt-0.5 shrink-0"/> <span>Minuta Jurídica via IA</span></li>
                            <li className="flex items-start"><Check size={16} className="text-blue-500 mr-2 mt-0.5 shrink-0"/> <span>Envio Digital Rastreável</span></li>
                            <li className="flex items-start"><Check size={16} className="text-blue-500 mr-2 mt-0.5 shrink-0"/> <span>PDF com Assinatura</span></li>
                            <li className="flex items-start"><Check size={16} className="text-blue-500 mr-2 mt-0.5 shrink-0"/> <span>Pagamento Único</span></li>
                        </ul>
                     </div>
                </div>

                <div onClick={() => setPaymentPlan('subscription')} className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${paymentPlan==='subscription' ? 'bg-slate-900 ring-2 ring-purple-500 shadow-2xl scale-[1.02]' : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-lg'}`}>
                     {paymentPlan === 'subscription' && <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">RECOMENDADO</div>}
                     <div className="flex flex-col h-full">
                         <h4 className={`font-bold text-xl ${paymentPlan==='subscription' ? 'text-white' : 'text-slate-900'}`}>Assinatura Pro</h4>
                         <p className={`text-4xl font-bold mt-4 ${paymentPlan==='subscription' ? 'text-white' : 'text-slate-900'}`}>R$ 259,97 <span className="text-sm font-normal opacity-60">/mês</span></p>

                         <ul className={`mt-6 space-y-3 text-sm text-left ${paymentPlan === 'subscription' ? 'text-slate-300' : 'text-slate-600'}`}>
                            <li className="flex items-start"><Check size={16} className={`mr-2 mt-0.5 shrink-0 ${paymentPlan === 'subscription' ? 'text-purple-400' : 'text-purple-600'}`}/> <span><strong>10 Notificações</strong> / mês</span></li>
                            <li className="flex items-start"><Check size={16} className={`mr-2 mt-0.5 shrink-0 ${paymentPlan === 'subscription' ? 'text-purple-400' : 'text-purple-600'}`}/> <span>Conciliações Ilimitadas</span></li>
                            <li className="flex items-start"><Check size={16} className={`mr-2 mt-0.5 shrink-0 ${paymentPlan === 'subscription' ? 'text-purple-400' : 'text-purple-600'}`}/> <span>Dashboard de Gestão</span></li>
                            <li className="flex items-start"><Check size={16} className={`mr-2 mt-0.5 shrink-0 ${paymentPlan === 'subscription' ? 'text-purple-400' : 'text-purple-600'}`}/> <span>Suporte Prioritário</span></li>
                            <li className="flex items-start"><Check size={16} className={`mr-2 mt-0.5 shrink-0 ${paymentPlan === 'subscription' ? 'text-purple-400' : 'text-purple-600'}`}/> <span>Cancele quando quiser</span></li>
                        </ul>
                     </div>
                </div>
             </div>
             
             <div className="max-w-md mx-auto pt-6">
                 <button onClick={() => setPaymentStage('input')} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl flex items-center justify-center hover:bg-slate-800 transition transform hover:scale-105">
                     Ir para Pagamento <ArrowRight className="ml-2" size={18} />
                 </button>
             </div>
         </div>
      );
     
      if (paymentStage === 'input') return (
        <div className="pb-12 max-w-md mx-auto animate-fade-in text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Confirmar Pagamento</h3>
            <p className="text-slate-500 text-sm mb-8">
                Valor Total: <strong className="text-slate-900 ml-1">R$ {calculateTotal().toFixed(2)}</strong>.
                <br/>Selecione abaixo como deseja pagar.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                    onClick={() => handleConfirmPayment('CREDIT_CARD')}
                    disabled={isProcessingAction}
                    className="flex flex-col items-center justify-center p-6 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group disabled:opacity-50"
                >
                    <CreditCard size={32} className="text-slate-400 group-hover:text-purple-600 mb-3"/>
                    <span className="font-bold text-slate-700 group-hover:text-purple-700">Cartão de Crédito</span>
                </button>

                <button 
                    onClick={() => handleConfirmPayment('PIX')}
                    disabled={isProcessingAction}
                    className="flex flex-col items-center justify-center p-6 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50"
                >
                    <QrCode size={32} className="text-slate-400 group-hover:text-emerald-600 mb-3"/>
                    <span className="font-bold text-slate-700 group-hover:text-emerald-700">Pix</span>
                </button>
            </div>

            {isProcessingAction && (
                <div className="flex items-center justify-center text-sm text-slate-500">
                    <Loader2 className="animate-spin mr-2" size={16}/> Gerando cobrança segura...
                </div>
            )}

            <button onClick={() => setPaymentStage('selection')} className="mt-6 text-sm text-slate-500 hover:underline">Voltar</button>
        </div>
      );

      return null;
  };

  // ... (renderStepContent e return mantidos iguais) ...
  const renderStepContent = () => {
    switch(currentStep) {
        case 1:
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in pb-12">
                    {LAW_AREAS.map(area => (
                        <div 
                            key={area.id}
                            onClick={() => setFormData(prev => ({ ...prev, areaId: area.id }))}
                            className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col items-center justify-center text-center gap-3 h-32 hover:scale-105 ${
                                formData.areaId === area.id 
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                                : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200 hover:shadow-sm'
                            }`}
                        >
                            <area.icon size={24} />
                            <span className="text-xs font-bold">{area.name}</span>
                        </div>
                    ))}
                </div>
            );
        case 2:
            return (
                <div className="space-y-6 pb-12 animate-slide-in-right">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {currentArea?.species.map((specie, idx) => (
                            <div 
                                key={idx}
                                onClick={() => setFormData(prev => ({ ...prev, species: specie }))}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.species === specie ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md' : 'border-slate-100 bg-white hover:border-purple-200'}`}
                            >
                                <span className="text-sm font-medium">{specie}</span>
                            </div>
                        ))}
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-8">
                        <label className="text-sm font-bold text-slate-700 mb-2 block flex items-center">
                            <FileText size={16} className="mr-2 text-slate-400"/>
                            Descrição Detalhada dos Fatos
                        </label>
                        <textarea 
                            value={formData.facts}
                            onChange={(e) => setFormData(prev => ({ ...prev, facts: e.target.value }))}
                            className="w-full h-40 p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-100 text-sm"
                            placeholder="Descreva o ocorrido com detalhes, datas e valores..."
                        />
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className="text-sm font-bold text-slate-700 mb-4 block flex items-center">
                            <UploadCloud size={16} className="mr-2 text-slate-400"/>
                            Anexar Evidências (Fotos, Vídeos, PDFs)
                        </label>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            {localFiles.map((file) => (
                                <div key={file.id} className="relative group border border-slate-200 rounded-lg overflow-hidden h-24 flex items-center justify-center bg-slate-50">
                                    {file.type === 'image' ? (
                                        <img src={file.previewUrl} className="w-full h-full object-cover" alt="preview"/>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400">
                                            <FileText size={24} />
                                            <span className="text-[10px] mt-1">{file.type}</span>
                                        </div>
                                    )}
                                    <button onClick={() => removeFile(file.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            
                            <label className="border-2 border-dashed border-slate-300 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                                <UploadCloud size={24} className="text-slate-400 mb-1" />
                                <span className="text-xs text-slate-500 font-bold">Adicionar</span>
                                <input type="file" multiple className="hidden" onChange={handleFileSelect} />
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
                                <button 
                                    onClick={() => { setRole('self'); setPartiesStep('forms'); }}
                                    className="p-8 rounded-2xl border-2 border-slate-100 bg-white hover:border-blue-400 hover:shadow-lg transition-all group text-left"
                                >
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <User size={24} />
                                    </div>
                                    <h4 className="font-bold text-lg text-slate-800">Eu mesmo (Pessoa Física)</h4>
                                    <p className="text-sm text-slate-500 mt-2">Estou agindo em meu próprio nome.</p>
                                </button>
                                <button 
                                    onClick={() => { setRole('representative'); setPartiesStep('forms'); }}
                                    className="p-8 rounded-2xl border-2 border-slate-100 bg-white hover:border-purple-400 hover:shadow-lg transition-all group text-left"
                                >
                                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Briefcase size={24} />
                                    </div>
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

                            {role === 'representative' && (
                                <PersonForm 
                                    title="Representante (Você)" 
                                    data={formData.representative} 
                                    section="representative"
                                    colorClass="border-purple-500"
                                    onInputChange={handleInputChange} 
                                    onAddressChange={handleAddressChange} 
                                />
                            )}
                            
                            <PersonForm 
                                title={role === 'representative' ? "Cliente (Parte Ativa)" : "Seus Dados (Remetente)"} 
                                data={formData.sender} 
                                section="sender"
                                colorClass="border-blue-500"
                                onInputChange={handleInputChange} 
                                onAddressChange={handleAddressChange} 
                            />

                            <PersonForm 
                                title="Parte Contrária (Destinatário)" 
                                data={formData.recipient} 
                                section="recipient"
                                colorClass="border-red-500"
                                onInputChange={handleInputChange} 
                                onAddressChange={handleAddressChange} 
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
                            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Video size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800">Propor Videoconferência</h3>
                            <p className="text-slate-500 mt-2">
                                Aumente em 80% a chance de acordo agendando uma conversa amigável antes de litigar.
                                A IA incluirá o convite no documento final.
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-6">
                            <label className="flex items-center justify-between p-4 border-2 border-slate-100 rounded-xl cursor-pointer hover:border-purple-200 transition-colors mb-6">
                                <div className="flex items-center">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${formData.scheduleMeeting ? 'border-purple-600 bg-purple-600' : 'border-slate-300'}`}>
                                        {formData.scheduleMeeting && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className="font-bold text-slate-700">Sim, desejo agendar uma conciliação</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={formData.scheduleMeeting} 
                                    onChange={() => setFormData(p => ({ ...p, scheduleMeeting: !p.scheduleMeeting }))} 
                                />
                            </label>

                            {formData.scheduleMeeting && (
                                <div className="animate-fade-in">
                                    <CreativeMeetingSelector 
                                        date={formData.meetingDate} 
                                        time={formData.meetingTime} 
                                        setDate={handleDateChange} 
                                        setTime={handleTimeChange}
                                        disabled={false}
                                    />
                                    <p className="text-xs text-slate-400 mt-4 text-center flex items-center justify-center">
                                        <Lock size={12} className="mr-1" />
                                        O link seguro do Google Meet será gerado automaticamente.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        case 5: // IA GENERATION
            return (
                <div className="pb-12 animate-slide-in-right flex flex-col items-center justify-center min-h-[400px]">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                        <Wand2 size={64} className="text-slate-800 relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">IA Pronta para Redigir</h3>
                    <p className="text-slate-500 text-center max-w-md mb-8">
                        Nossa inteligência artificial analisou os fatos {formData.scheduleMeeting ? 'e os dados da reunião' : ''} para gerar uma notificação jurídica completa e fundamentada.
                    </p>
                    <button 
                        onClick={handleGenerateContent}
                        disabled={isGenerating}
                        className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold shadow-xl hover:bg-slate-800 transition-transform active:scale-95 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 text-yellow-400" />}
                        {isGenerating ? 'Gerando Documento...' : 'Gerar Minuta Jurídica'}
                    </button>
                </div>
            );
        case 6: // ASSINATURA
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
                                
                                <div className="space-y-4 whitespace-pre-wrap text-justify">
                                    {formData.generatedContent}
                                </div>
                                
                                {signatureData && (
                                    <div className="mt-16 pt-8 border-t border-slate-300 w-64">
                                        <img src={signatureData} alt="Assinatura" className="h-12 object-contain mb-2 -ml-4" />
                                        <p className="font-bold text-slate-900">{formData.sender.name}</p>
                                        <p className="text-xs text-slate-500">CPF: {formData.sender.cpfCnpj}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Assinado digitalmente via Notify</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="w-full lg:w-96 space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center"><PenTool size={16} className="mr-2"/> Assinatura Digital</h4>
                                <div 
                                    ref={containerRef}
                                    className="border-2 border-dashed border-slate-300 rounded-xl h-32 bg-slate-50 cursor-crosshair relative touch-none"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={endDrawing}
                                    onMouseLeave={endDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={endDrawing}
                                >
                                    <canvas ref={canvasRef} className="absolute inset-0" />
                                    {!isDrawing && !signatureData && (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none">
                                            <span className="text-xs">Assine aqui</span>
                                        </div>
                                    )}
                                </div>
                                <button onClick={clearSignature} className="text-xs text-red-500 mt-2 font-bold hover:underline">Limpar Assinatura</button>
                            </div>

                            <button 
                                onClick={async () => {
                                    try {
                                        await handlePersistData();
                                        setCurrentStep(7); // Vai para Pagamento
                                    } catch(e) {
                                        alert("Erro ao salvar documento. Tente novamente.");
                                    }
                                }}
                                disabled={isSavingData}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-emerald-200 transition-all flex items-center justify-center disabled:opacity-70"
                            >
                                {isSavingData ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                                {isSavingData ? 'Salvando...' : 'Finalizar e Pagar'}
                            </button>
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
                   <button 
                    onClick={() => {
                        if (currentStep === 1) onBack?.();
                        else setCurrentStep(prev => prev - 1);
                    }}
                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                   >
                       Voltar
                   </button>
                   
                   {currentStep < 6 && (
                       <button 
                        onClick={() => setCurrentStep(prev => prev + 1)}
                        disabled={currentStep === 1 && !formData.areaId}
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
