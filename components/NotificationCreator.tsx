import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadEvidence, deleteEvidence, uploadSignedPdf } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { jsPDF } from "jspdf";
import { 
  Wand2, Scale, Users, 
  FileText, PenTool, CreditCard, Check, Loader2, 
  AlertCircle, Briefcase, ShoppingBag, Home, Heart, Gavel, Globe,
  Building2, Calculator, Landmark, Stethoscope, Leaf, Anchor, Plane, Zap, Rocket, Laptop, Trophy, FileSignature, Scroll, UploadCloud, X, MapPin, UserCheck, UserCog, Video, User, ShieldCheck, Clock3, MessageCircle, Smartphone, Mail, Package, ZapIcon, Send, Lock, Unlock, AlertTriangle, QrCode, Copy, CheckCircle2, ArrowRight, Calendar, Clock, CreditCard as CardIcon, ChevronLeft, Eye
} from 'lucide-react';

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
  onBack?: () => void;
}

const STEPS = [
  { id: 1, label: 'Áreas', icon: Scale },
  { id: 2, label: 'Ocorrências', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Geração', icon: Wand2 },
  { id: 5, label: 'Assinatura', icon: PenTool },
  { id: 6, label: 'Pagamento', icon: CreditCard },
];

interface LawArea {
    id: string;
    name: string;
    icon: any;
    desc: string;
    species: string[];
}

const LAW_AREAS: LawArea[] = [
  { 
    id: 'civil', name: 'Civil', icon: Scale, desc: 'Relações privadas, obrigações e bens.',
    species: ['Cobrança de dívidas', 'Rescisão de contratos', 'Restituição de valores', 'Indenização por atraso', 'Notificação de descumprimento contratual', 'Reparação de danos morais/materiais']
  },
  { 
    id: 'trabalhista', name: 'Trabalhista', icon: Briefcase, desc: 'Relações de trabalho e emprego.',
    species: ['Pagamento de salários atrasados', 'Rescisão indireta', 'Assédio moral', 'Verbas rescisórias', 'Horas extras não pagas', 'Reintegração de emprego']
  },
  { 
    id: 'consumidor', name: 'Consumidor', icon: ShoppingBag, desc: 'Defesa de quem adquire produtos/serviços.',
    species: ['Cobrança indevida', 'Produto com defeito', 'Cancelamento de serviços', 'Falha na entrega', 'Garantia não cumprida', 'Publicidade enganosa']
  },
  { 
    id: 'imobiliario', name: 'Imobiliário', icon: Home, desc: 'Posse, propriedade e locação.',
    species: ['Cobrança de aluguel', 'Rescisão de contrato de locação', 'Multa por atraso', 'Danos ao imóvel', 'Notificação de despejo', 'Vícios construtivos']
  },
  { 
    id: 'contratual', name: 'Contratual', icon: FileSignature, desc: 'Acordos firmados entre partes.',
    species: ['Descumprimento de contrato', 'Alteração unilateral', 'Pagamento não realizado', 'Revisão contratual', 'Multa contratual', 'Distrato']
  },
  { 
    id: 'familia', name: 'Família', icon: Heart, desc: 'Relações familiares e parentais.',
    species: ['Pensão alimentícia', 'Guarda de filhos', 'Divórcio amigável', 'Partilha de bens', 'Reconhecimento de união estável', 'Regulamentação de visitas']
  },
  { 
    id: 'sucessoes', name: 'Sucessões', icon: Scroll, desc: 'Transferência de patrimônio pós-morte.',
    species: ['Inventário extrajudicial', 'Partilha de bens', 'Testamento', 'Herança', 'Quitação de direitos hereditários', 'Sonegação de bens']
  },
  { 
    id: 'empresarial', name: 'Empresarial', icon: Building2, desc: 'Atividades econômicas e sociedades.',
    species: ['Cobrança entre empresas', 'Descumprimento de contrato B2B', 'Multa por inadimplência', 'Rescisão de sociedade', 'Notificação de inadimplência', 'Concorrência desleal']
  },
  { 
    id: 'tributario', name: 'Tributário', icon: Calculator, desc: 'Relação com o Fisco e impostos.',
    species: ['Contestação de tributos indevidos', 'Parcelamento de dívidas', 'Revisão de impostos', 'Notificação de débitos', 'Pedido de compensação', 'Isenção fiscal']
  },
  { 
    id: 'criminal', name: 'Criminal', icon: Gavel, desc: 'Infrações penais e delitos.',
    species: ['Crimes contra a honra', 'Ameaças', 'Violação de propriedade', 'Notificação de restituição', 'Acordo penal extrajudicial', 'Notícia-crime']
  },
  { 
    id: 'administrativo', name: 'Administrativo', icon: Landmark, desc: 'Relação com órgãos públicos.',
    species: ['Obrigações não cumpridas', 'Multa administrativa', 'Reclamação formal', 'Pedido de regularização', 'Comunicação de descumprimento', 'Recurso administrativo']
  },
  { 
    id: 'previdenciario', name: 'Previdenciário', icon: Stethoscope, desc: 'Seguridade social e benefícios.',
    species: ['Cobrança de benefícios atrasados', 'Revisão de aposentadoria', 'Pensão por morte', 'Auxílio-doença', 'Notificação de indeferimento', 'Prova de vida']
  },
  { 
    id: 'ambiental', name: 'Ambiental', icon: Leaf, desc: 'Proteção ao meio ambiente.',
    species: ['Danos ambientais leves', 'Multa por descumprimento', 'Recuperação ambiental', 'Comunicação de irregularidades', 'Reclamação extrajudicial', 'Poluição sonora']
  },
  { 
    id: 'internacional', name: 'Internacional', icon: Globe, desc: 'Relações entre nações ou estrangeiros.',
    species: ['Cobrança internacional', 'Notificação de contratos internacionais', 'Multa por descumprimento', 'Alteração contratual', 'Notificação de inadimplência', 'Imigração']
  },
  { 
    id: 'maritimo', name: 'Marítimo', icon: Anchor, desc: 'Navegação e comércio no mar.',
    species: ['Descumprimento de frete', 'Cobrança de serviços', 'Atraso de carga', 'Reclamação por danos leves', 'Alteração contratual', 'Demurrage']
  },
  { 
    id: 'aeronautico', name: 'Aeronáutico', icon: Plane, desc: 'Transporte aéreo e aviação.',
    species: ['Cobrança de serviços aéreos', 'Cancelamento de voo', 'Contratos de fretamento', 'Extravio de bagagem', 'Reclamação por atrasos', 'Overbooking']
  },
  { 
    id: 'energetico', name: 'Energético', icon: Zap, desc: 'Energia elétrica e fontes.',
    species: ['Cobrança indevida de tarifas', 'Falta de fornecimento', 'Notificação de reajuste', 'Contestação de contas', 'Solicitação de regularização', 'Danos elétricos']
  },
  { 
    id: 'espacial', name: 'Espacial', icon: Rocket, desc: 'Direito aeroespacial (Nichado).',
    species: ['Descumprimento contratual', 'Notificação de atrasos', 'Cobrança de serviços', 'Alteração de cronogramas', 'Reclamação formal']
  },
  { 
    id: 'digital', name: 'Digital', icon: Laptop, desc: 'Internet, tecnologia e dados.',
    species: ['Uso indevido de marca', 'Violação de direitos autorais', 'Software sem licença', 'Uso de patente indevida', 'Notificação de infração', 'Remoção de conteúdo']
  },
  { 
    id: 'esportivo', name: 'Esportivo', icon: Trophy, desc: 'Atletas, clubes e competições.',
    species: ['Descumprimento de contratos de atleta', 'Notificação de patrocínios', 'Uso indevido de imagem', 'Alteração contratual', 'Multas contratuais', 'Direito de arena']
  }
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
    },
    card: (value: string) => {
      return value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').substring(0, 19);
    },
    expiry: (value: string) => {
      return value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').substring(0, 5);
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

// LIMPEZA DE MARKDOWN PARA PDF
const cleanTextForPDF = (text: string) => {
    return text
        .replace(/\*\*/g, '') // Remove negrito
        .replace(/\*/g, '')   // Remove itálico/listas simples
        .replace(/#/g, '')    // Remove headers
        .replace(/\[|\]/g, '') // Remove colchetes se houver
        .trim();
};

const PersonForm: React.FC<any> = ({ title, data, section, colorClass, onInputChange, onAddressChange, documentLabel = "CPF ou CNPJ", documentMask = MASKS.cpfCnpj, documentMaxLength = 18, documentPlaceholder }) => {
    const getIcon = () => {
        if (section === 'representative') return <UserCog className="mr-2" />;
        if (section === 'sender') return <UserCheck className="mr-2" />;
        if (section === 'recipient') return <User className="mr-2" />;
        return <AlertCircle className="mr-2" />;
    };

    return (
        <div className={`bg-white p-4 md:p-6 rounded-2xl border-l-4 ${colorClass} shadow-sm border-t border-r border-b border-slate-200 mb-6`}>
            <h3 className="font-bold text-slate-800 mb-6 flex items-center text-lg">
                {getIcon()}
                {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <input type="text" value={data.name} onChange={e => onInputChange(section, 'name', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="Nome completo ou Razão Social" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{documentLabel}</label>
                    <input type="text" value={data.cpfCnpj} maxLength={documentMaxLength} onChange={e => onInputChange(section, 'cpfCnpj', documentMask(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder={documentPlaceholder || documentLabel} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                    <input type="text" value={data.phone} maxLength={15} onChange={e => onInputChange(section, 'phone', MASKS.phone(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="(00) 00000-0000" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                    <input type="email" value={data.email} onChange={e => onInputChange(section, 'email', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" placeholder="email@exemplo.com" />
                </div>
            </div>
            <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center"><MapPin size={12} className="mr-1" /> Endereço</h4>
                <div className="grid grid-cols-6 gap-2 md:gap-3">
                    <div className="col-span-3 md:col-span-2"><input type="text" value={data.address.cep} onChange={e => onAddressChange(section, 'cep', MASKS.cep(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" placeholder="CEP" /></div>
                    <div className="col-span-3 md:col-span-4"><input type="text" value={data.address.street} onChange={e => onAddressChange(section, 'street', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" placeholder="Rua" /></div>
                    <div className="col-span-2"><input type="text" value={data.address.number} onChange={e => onAddressChange(section, 'number', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" placeholder="Nº" /></div>
                    <div className="col-span-4"><input type="text" value={data.address.complement} onChange={e => onAddressChange(section, 'complement', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" placeholder="Comp." /></div>
                    <div className="col-span-6 md:col-span-2"><input type="text" value={data.address.neighborhood} onChange={e => onAddressChange(section, 'neighborhood', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" placeholder="Bairro" /></div>
                    <div className="col-span-4 md:col-span-3"><input type="text" value={data.address.city} onChange={e => onAddressChange(section, 'city', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" placeholder="Cidade" /></div>
                    <div className="col-span-2 md:col-span-1"><input type="text" value={data.address.state} onChange={e => onAddressChange(section, 'state', e.target.value.toUpperCase())} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none text-center" placeholder="UF" /></div>
                </div>
            </div>
        </div>
    );
};

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [error, setError] = useState('');
  const [notificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  
  // State for Roles
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');
  const [role, setRole] = useState<'self' | 'representative' | null>(null);

  // Canvas Logic
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  // State for Generation Success View
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  // State for Pix Copy Feedback
  const [pixCopied, setPixCopied] = useState(false);

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

  // Alterado para LocalAttachment: arquivos ficam apenas no frontend até a assinatura
  const [localFiles, setLocalFiles] = useState<LocalAttachment[]>([]);
  // Evidencias confirmadas após upload (para referência)
  const [uploadedEvidences, setUploadedEvidences] = useState<EvidenceItem[]>([]);

  const [paymentPlan, setPaymentPlan] = useState<'single' | 'subscription'>('single');
  
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [paymentStage, setPaymentStage] = useState<'selection' | 'input' | 'protocol'>('selection');
  
  // Estado para dados do Cartão
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });

  // Estado para armazenar dados criados antes de sair (Protocolo)
  const [createdData, setCreatedData] = useState<{notif?: NotificationItem, meet?: Meeting, trans?: Transaction}>({});

  const currentArea = LAW_AREAS.find(a => a.id === formData.areaId);

  // Responsive Canvas Resize
  useEffect(() => {
    const resizeCanvas = () => {
        if (containerRef.current && canvasRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            if(canvasRef.current.width !== containerWidth) {
                canvasRef.current.width = containerWidth;
            }
        }
    };
    
    // Initial size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [currentStep]);

  const calculateTotal = () => {
    if (paymentPlan === 'subscription') return 259.97;
    // Preço do Combo Unitário
    return 57.92;
  };

  const handleInputChange = (section: 'sender' | 'recipient' | 'representative', field: string, value: string) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const handleAddressChange = (section: 'sender' | 'recipient' | 'representative', field: keyof Address, value: string) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], address: { ...prev[section].address, [field]: value } } }));
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = new Date(e.target.value);
      const day = date.getDay();
      
      // Validação: 0 = Domingo, 6 = Sábado
      if (day === 5 || day === 6) { 
         const dateParts = e.target.value.split('-');
         const localDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
         const localDay = localDate.getDay();
         
         if (localDay === 0 || localDay === 6) {
             setError("Agendamentos disponíveis apenas de Segunda a Sexta-feira.");
             setFormData(prev => ({ ...prev, meetingDate: '' }));
             return;
         }
      }
      
      setError('');
      setFormData(prev => ({ ...prev, meetingDate: e.target.value }));
  };

  // Função para Destrancar Edição
  const unlockForEditing = () => {
      if(confirm('Atenção: Ao editar o documento, sua assinatura atual será removida e você precisará assinar novamente. Deseja continuar?')) {
          setFormData(prev => ({ ...prev, signed: false }));
          setSignatureData(null);
      }
  };

  // Salva arquivos localmente (Sem upload)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(''); // Limpa erros antigos
    if (!user) {
        setError("Você precisa estar autenticado para enviar arquivos.");
        return;
    }

    if (e.target.files && e.target.files.length > 0) {
        const filesToAdd: LocalAttachment[] = [];
        const MAX_SIZE_MB = 10; // Limite de 10MB para evitar crash do browser no base64

        Array.from(e.target.files).forEach((file: File) => {
            // Validação de Tamanho
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                setError(`Arquivo "${file.name}" excede o limite de ${MAX_SIZE_MB}MB.`);
                return;
            }

            let type: 'image' | 'video' | 'document' = 'document';
            if (file.type.startsWith('image/')) {
                type = 'image';
            } else if (file.type.startsWith('video/')) {
                type = 'video';
            } else if (file.type === 'application/pdf') {
                type = 'document'; // Garante que PDF é tratado como documento
            } else {
                // Fallback genérico, mas pode ser removido se o accept do input for estrito
                type = 'document'; 
            }

            filesToAdd.push({
                id: `local-${Date.now()}-${Math.random()}`,
                file: file,
                name: file.name,
                type: type,
                previewUrl: URL.createObjectURL(file)
            });
        });

        if (filesToAdd.length > 0) {
            setLocalFiles(prev => [...prev, ...filesToAdd]);
        }
        e.target.value = ''; 
    }
  };

  const removeAttachment = (index: number) => {
    setLocalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
        setFormData(prev => ({ ...prev, signed: false }));
    }
  };
  const confirmSignature = () => {
     const canvas = canvasRef.current;
     if (canvas) {
        setSignatureData(canvas.toDataURL());
        setFormData(prev => ({ ...prev, signed: true }));
     }
  };
  
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    let clientX, clientY;
    
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    const rect = canvas.getBoundingClientRect();
    return { offsetX: clientX - rect.left, offsetY: clientY - rect.top };
  };

  const handleNext = async () => {
    setError('');

    if (currentStep === 1 && !formData.areaId) return setError('Selecione uma área.');
    if (currentStep === 2 && (!formData.species || !formData.facts)) return setError('Preencha a espécie e os fatos.');
    if (currentStep === 3) {
        if (partiesStep === 'role_selection') return setError('Selecione quem está preenchendo.');
        if (!formData.sender.name || !formData.recipient.name) return setError('Preencha os dados das partes.');
        if (role === 'representative' && !formData.representative.name) return setError('Preencha os dados do representante.');
    }
    if (currentStep === 4) {
          if (!formData.generatedContent) {
              await generateContent();
              if (!formData.generatedContent) return;
          }
    }
    if (currentStep === 5) {
        if (!formData.signed) return setError('Você precisa assinar o documento.');
        
        // --- TRANSIÇÃO CRÍTICA: SALVAR TUDO E IR PARA PAGAMENTO ---
        await handlePersistData();
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(curr => curr + 1);
      window.scrollTo(0,0);
    }
  };

  const generateContent = async () => {
    setIsGenerating(true);
    setShowSuccessScreen(false); // Reset para garantir animação
    setError(''); // Limpa erros anteriores

    try {
      let promptContext = `${formData.facts}`; // Fatos são a base
      
      // CONSTRUÇÃO DETALHADA DAS PARTES (QUALIFICAÇÃO COMPLETA)
      const senderAddr = formatAddressString(formData.sender.address);
      const recipientAddr = formatAddressString(formData.recipient.address);
      
      let partiesBlock = `
      [DADOS OBRIGATÓRIOS PARA O PREÂMBULO]
      
      NOTIFICANTE (REMETENTE):
      Nome: ${formData.sender.name}
      CPF/CNPJ: ${formData.sender.cpfCnpj}
      Endereço Completo: ${senderAddr}
      Contato: ${formData.sender.phone} | ${formData.sender.email}
      `;

      if (role === 'representative') {
          const repAddr = formatAddressString(formData.representative.address);
          partiesBlock += `
          REPRESENTADO POR (PROCURADOR/ADVOGADO):
          Nome: ${formData.representative.name}
          CPF: ${formData.representative.cpfCnpj}
          Endereço Profissional: ${repAddr}
          Contato: ${formData.representative.phone} | ${formData.representative.email}
          `;
      }

      partiesBlock += `
      NOTIFICADO (DESTINATÁRIO):
      Nome: ${formData.recipient.name}
      CPF/CNPJ: ${formData.recipient.cpfCnpj}
      Endereço Completo: ${recipientAddr}
      Contato: ${formData.recipient.phone} | ${formData.recipient.email}
      `;

      // Adiciona o bloco de partes ao contexto
      promptContext += `\n\n${partiesBlock}`;
      
      // Apenas adiciona contexto de reunião se os dados estiverem preenchidos E o checkbox marcado
      if (formData.scheduleMeeting && formData.meetingDate && formData.meetingTime) {
          const dateParts = formData.meetingDate.split('-');
          const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
          
          promptContext += `\n\n[IMPORTANTE - CONCILIAÇÃO AGENDADA]
          O Notificante AGENDOU uma reunião de conciliação por videoconferência.
          Data: ${formattedDate}
          Horário: ${formData.meetingTime}
          Link: https://meet.google.com/gvd-nmhs-jjv
          
          INSTRUÇÃO OBRIGATÓRIA: Adicione um parágrafo de destaque no corpo da notificação (antes dos pedidos ou das consequências) convidando formalmente o Notificado para esta audiência de tentativa de conciliação extrajudicial, citando expressamente a data, hora e o link de acesso acima.`;
      } else if (formData.scheduleMeeting) {
          setError("Aviso: Texto gerado sem dados de agendamento (Data/Hora não preenchidos).");
      }

      // Preparar arquivos LOCAIS para a IA
      const currentAttachments: Attachment[] = [];
      if (localFiles && localFiles.length > 0) {
          for (const lf of localFiles) {
              // Passa diretamente o objeto File local
              currentAttachments.push({
                  file: lf.file,
                  preview: lf.previewUrl,
                  type: lf.type
              });
          }
      }

      const text = await generateNotificationText(
        formData.recipient.name || '[Destinatário]',
        formData.species,
        promptContext, // Passamos o contexto enriquecido com qualificações
        formData.tone,
        currentAttachments,
        // PASSANDO O CONTEXTO DE NAVEGAÇÃO
        {
            area: currentArea?.name || 'Direito Geral',
            species: formData.species,
            areaDescription: currentArea?.desc || ''
        }
      );
      
      setFormData(prev => ({ ...prev, generatedContent: text, subject: formData.species }));
      setShowSuccessScreen(true); // Exibe tela de sucesso
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao gerar texto: Verifique sua conexão.');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- PDF GENERATION LOGIC 2.0 (PROFESSIONAL & PAGINATED) ---
  const generateSignedPdfBlob = async (): Promise<Blob> => {
      // 1. Configuração Inicial A4
      const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
      });

      // Constantes de Layout
      const margin = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      const contentWidth = pageWidth - (margin * 2);
      const startY = 45; // Espaço para cabeçalho
      const footerY = 280;
      
      // Função para desenhar Cabeçalho em todas as páginas
      const drawHeader = (doc: jsPDF) => {
          // Logo/Nome "NOTIFY"
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
          doc.setTextColor(40, 40, 50); // Dark Slate
          doc.text("NOTIFY", margin, 20);
          
          // Subtítulo Sofisticado
          doc.setFontSize(8);
          doc.setTextColor(150); // Grey
          doc.text("INTELIGÊNCIA JURÍDICA E AUTOMAÇÃO", margin, 25);
          
          // Data no canto direito
          doc.setFontSize(9);
          doc.text(`Data: ${new Date().toLocaleDateString()}`, pageWidth - margin, 20, { align: "right" });
          doc.text(`Ref: ${notificationId}`, pageWidth - margin, 25, { align: "right" });

          // Linha decorativa
          doc.setDrawColor(200);
          doc.setLineWidth(0.5);
          doc.line(margin, 30, pageWidth - margin, 30);
      };

      // Função para desenhar Rodapé em todas as páginas
      const drawFooter = (doc: jsPDF, pageNum: number) => {
          doc.setDrawColor(200);
          doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
          
          doc.setFont("times", "italic");
          doc.setFontSize(8);
          doc.setTextColor(150);
          
          const footerText = `Documento gerado e assinado eletronicamente via Plataforma Notify. ID: ${notificationId}`;
          doc.text(footerText, margin, footerY);
          
          doc.text(`Página ${pageNum}`, pageWidth - margin, footerY, { align: "right" });
      };

      // Função para desenhar Marca D'água
      const drawWatermark = (doc: jsPDF) => {
          doc.saveGraphicsState();
          doc.setTextColor(245, 245, 245); // Muito claro
          doc.setFontSize(60);
          doc.setFont("helvetica", "bold");
          
          // Rotaciona e centraliza
          const text = "NOTIFY";
          const x = pageWidth / 2;
          const y = pageHeight / 2;
          
          // Solução simplificada para rotação sem context complexo (jsPDF basic)
          // Se precisar de rotação avançada, usar context2d, mas aqui centralizamos simples
          // para compatibilidade.
          doc.text(text, x, y, { align: "center", angle: 45 });
          doc.restoreGraphicsState();
      };

      // 2. Preparar Texto
      const cleanBody = cleanTextForPDF(formData.generatedContent);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 30); // Preto suave

      // Divide o texto em linhas que cabem na largura
      const textLines = doc.splitTextToSize(cleanBody, contentWidth);
      const lineHeight = 6; // mm

      // 3. Renderização Paginada
      let currentY = startY;
      let currentPage = 1;

      // Desenha elementos da primeira página
      drawHeader(doc);
      drawWatermark(doc);
      drawFooter(doc, currentPage);

      // Loop pelas linhas
      for (let i = 0; i < textLines.length; i++) {
          // Verifica se cabe na página
          if (currentY + lineHeight > footerY - 10) {
              doc.addPage();
              currentPage++;
              currentY = startY;
              
              drawHeader(doc);
              drawWatermark(doc);
              drawFooter(doc, currentPage);
              
              doc.setFont("times", "normal");
              doc.setFontSize(11);
              doc.setTextColor(20, 20, 30);
          }
          
          doc.text(textLines[i], margin, currentY);
          currentY += lineHeight;
      }

      // 4. Assinatura
      if (signatureData) {
          const signHeight = 25;
          // Verifica se cabe a assinatura
          if (currentY + signHeight + 20 > footerY - 10) {
              doc.addPage();
              currentPage++;
              currentY = startY;
              drawHeader(doc);
              drawWatermark(doc);
              drawFooter(doc, currentPage);
          }

          currentY += 15; // Espaço antes da assinatura
          
          const centerX = pageWidth / 2;
          const imgWidth = 50;
          const imgHeight = 20;

          doc.addImage(signatureData, 'PNG', centerX - (imgWidth/2), currentY, imgWidth, imgHeight);
          
          currentY += 22;
          doc.setDrawColor(50);
          doc.line(centerX - 40, currentY, centerX + 40, currentY);
          
          currentY += 5;
          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.text(formData.sender.name, centerX, currentY, { align: "center" });
          
          currentY += 5;
          doc.setFontSize(9);
          doc.setFont("times", "normal");
          doc.text(`CPF: ${formData.sender.cpfCnpj}`, centerX, currentY, { align: "center" });
          
          currentY += 6;
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text("Assinatura Digital Certificada - Notify", centerX, currentY, { align: "center" });
      }

      return doc.output('blob');
  };

  // --- LOGICA DE PERSISTENCIA (UPLOAD E SALVAR NO BANCO) ---
  const handlePersistData = async () => {
      setIsSavingData(true);
      setError('');
      try {
          if (!user) throw new Error("Usuário não autenticado");

          // 1. Gerar PDF Assinado (Novo Layout Profissional)
          const pdfBlob = await generateSignedPdfBlob();

          // 2. Upload do PDF para Storage
          const pdfUrl = await uploadSignedPdf(notificationId, pdfBlob);

          // 3. Upload das Evidências (Arquivos Locais -> Firebase)
          const newEvidenceItems: EvidenceItem[] = [];
          if (localFiles.length > 0) {
              for (const lf of localFiles) {
                  const uploaded = await uploadEvidence(notificationId, lf.file);
                  newEvidenceItems.push(uploaded);
              }
          }
          setUploadedEvidences(newEvidenceItems); // Atualiza estado com URLs remotas

          const totalAmount = calculateTotal();

          // 4. Montar Objeto da Notificação
          const finalNotification: NotificationItem = {
              id: notificationId,
              senderUid: user.uid,
              senderName: formData.sender.name,
              senderEmail: formData.sender.email,
              senderPhotoUrl: user.photoURL || undefined,
              recipientName: formData.recipient.name,
              recipientEmail: formData.recipient.email,
              recipientCpf: formData.recipient.cpfCnpj.replace(/\D/g, ''),
              area: currentArea?.name || '',
              species: formData.species,
              facts: formData.facts,
              subject: formData.subject || formData.species,
              content: formData.generatedContent,
              evidences: newEvidenceItems, // Usa as evidências com URL remota
              pdfUrl: pdfUrl, // URL real do Storage
              signatureBase64: signatureData || undefined,
              createdAt: new Date().toISOString(),
              status: NotificationStatus.PENDING_PAYMENT, // Cria como Pendente
              paymentMethod: 'pix', // Default, atualizado no passo 6
              paymentAmount: totalAmount
          };

          // 5. Salvar no Firestore
          await saveNotification(finalNotification);

          // 6. Preparar Transação e Reunião (Ainda sem salvar no banco, apenas preparo para checkout)
          const newTransaction: Transaction = {
              id: `TX-${Date.now()}`,
              description: paymentPlan === 'subscription' ? 'Assinatura Mensal' : `Notificação - ${formData.species}`,
              amount: totalAmount,
              date: new Date().toISOString(),
              status: 'Pendente'
          };

          let newMeeting: Meeting | undefined = undefined;
          if (formData.scheduleMeeting) {
              const code = `${Math.random().toString(36).substr(2, 3)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 3)}`;
              newMeeting = {
                  id: `MEET-${Date.now()}`,
                  hostUid: user.uid,
                  hostName: user.displayName || 'Anfitrião',
                  title: `Conciliação: ${formData.species}`,
                  date: formData.meetingDate,
                  time: formData.meetingTime,
                  guestEmail: formData.recipient.email,
                  guestCpf: formData.recipient.cpfCnpj,
                  meetLink: `https://meet.google.com/${code}`,
                  createdAt: new Date().toISOString(),
                  status: 'canceled' // Começa cancelada/pendente até pagar
              };
              await createMeeting(newMeeting); // Cria reunião já
          }

          // Armazena dados para a etapa final
          setCreatedData({ notif: finalNotification, meet: newMeeting, trans: newTransaction });

      } catch (e: any) {
          console.error(e);
          // O erro genérico foi removido conforme solicitado, mostra erro real se houver
          setError("Erro ao salvar notificação: " + e.message);
          throw e; // Interrompe a navegação
      } finally {
          setIsSavingData(false);
      }
  };

  const handlePayLater = async () => {
      // Como os dados já foram persistidos na transição para o passo 6, 
      // "Pagar depois" deve avisar o App.tsx para atualizar a lista local
      if (createdData.notif) {
          onSave(createdData.notif, createdData.meet, createdData.trans);
      } else if (onBack) {
          onBack();
      }
  };

  const handleConfirmPayment = async () => {
      // Validação Cartão de Crédito
      if (paymentMethod === 'credit_card') {
          if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) {
              setError("Preencha todos os dados do cartão.");
              return;
          }
      }

      setIsProcessingPayment(true);
      setError('');
      try {
          if(!user || !createdData.notif) return;

          // Iniciar tentativa de pagamento (Simulada com sucesso garantido)
          const checkoutResponse = await initiateCheckout(createdData.notif);

          if (!checkoutResponse.success) {
             setError(checkoutResponse.error || "Erro ao iniciar pagamento. Tente novamente.");
             return;
          }

          if (checkoutResponse.checkoutUrl) {
             window.location.href = checkoutResponse.checkoutUrl;
             return;
          }

          // ** SUCESSO NO PAGAMENTO SIMULADO **
          
          // 1. Atualiza Status da Notificação para SENT (Para liberar para o destinatário CPF)
          const updatedNotif = { ...createdData.notif, status: NotificationStatus.SENT };
          await saveNotification(updatedNotif); // Salva novamente com status atualizado

          // 2. Atualiza Status da Transação
          const updatedTrans = { ...createdData.trans!, status: 'Pago' as const };

          // 3. Atualiza Reunião (Se agendada, torna-se ativa)
          let updatedMeeting = createdData.meet;
          if (createdData.meet) {
              updatedMeeting = { ...createdData.meet, status: 'scheduled' };
              await createMeeting(updatedMeeting);
          }

          // Atualiza CreatedData para exibição no recibo final
          setCreatedData({ notif: updatedNotif, meet: updatedMeeting, trans: updatedTrans });

          // AVANÇA PARA A TELA DE PROTOCOLO
          setPaymentStage('protocol');

      } catch (e) {
          console.error(e);
          setError("Erro ao processar finalização.");
      } finally {
          setIsProcessingPayment(false);
      }
  };

  const handleFinishProtocol = () => {
      if (createdData.notif) {
          onSave(createdData.notif, createdData.meet, createdData.trans);
      }
  };

  const handleCopyPix = () => {
      navigator.clipboard.writeText("00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913NOTIFY SERVICOS6009SAO PAULO62070503***6304E2CA");
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
  };

  const getFactsPlaceholder = () => {
      const area = formData.areaId;
      const spec = formData.species;
      
      if (area === 'civil') {
          if (spec.includes('Cobrança')) return "Descreva: 1. A origem da dívida (empréstimo, serviço, venda). 2. A data de vencimento. 3. O valor original e atualizado. 4. Tentativas de contato anteriores.";
          if (spec.includes('Contrato')) return "Descreva: 1. Qual cláusula foi descumprida. 2. A data do contrato. 3. O prejuízo causado.";
          return "Descreva os fatos com datas, valores e nomes das pessoas envolvidas...";
      }
      return "Descreva detalhadamente o ocorrido, incluindo datas importantes, valores envolvidos, locais e nomes das partes relacionadas. Quanto mais detalhes, melhor a IA redigirá seu documento.";
  };

  const renderStepContent = () => {
      switch(currentStep) {
          // ... (Cases 1, 2, 3, 4 remain identical)
          case 1: return (
            <div className="pb-12 relative">
                <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Qual é a natureza jurídica?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {LAW_AREAS.map(area => (
                        <button 
                            key={area.id} 
                            onClick={() => { setFormData(p => ({...p, areaId: area.id})); setTimeout(() => setCurrentStep(2), 150); }} 
                            className={`
                                group relative flex items-center p-4 rounded-2xl border transition-all duration-300 text-left
                                ${formData.areaId === area.id 
                                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-lg scale-[1.02]' 
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg hover:-translate-y-1'
                                }
                            `}
                        >
                            <div className={`
                                p-3 rounded-xl mr-4 shrink-0 transition-colors duration-300
                                ${formData.areaId === area.id ? 'bg-blue-500 text-white shadow-blue-200' : 'bg-slate-50 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}
                            `}>
                                <area.icon size={24} strokeWidth={1.5} />
                            </div>
                            <div className="overflow-hidden">
                                <span className={`block font-bold text-sm mb-0.5 truncate transition-colors ${formData.areaId === area.id ? 'text-blue-900' : 'text-slate-800 group-hover:text-blue-700'}`}>
                                    {area.name}
                                </span>
                                <span className={`text-xs font-medium truncate block transition-colors ${formData.areaId === area.id ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-500'}`}>
                                    {area.desc}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          );
          case 2: return (
              <div className="space-y-6 pb-12">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <h4 className="text-sm font-bold mb-3">Selecione a Espécie</h4>
                       <div className="flex flex-wrap gap-2">
                           {currentArea?.species.map(spec => (
                               <button key={spec} onClick={() => setFormData(p => ({...p, species: spec}))} className={`px-3 py-2 text-xs md:text-sm rounded-lg border transition ${formData.species === spec ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}>{spec}</button>
                           ))}
                       </div>
                   </div>
                   <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">Relato dos Fatos</label>
                       <textarea 
                            value={formData.facts} 
                            onChange={e => setFormData(p => ({...p, facts: e.target.value}))} 
                            className="w-full h-40 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-sm leading-relaxed" 
                            placeholder={getFactsPlaceholder()} 
                       />
                   </div>
                   
                   <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 relative bg-slate-50 transition-colors">
                        <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
                        <p className="text-sm text-slate-500 font-medium">Toque para anexar evidências</p>
                        <p className="text-xs text-slate-400 mt-1">Fotos, PDFs ou Vídeos (Máx 10MB)</p>
                        <input type="file" multiple accept="image/*,video/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                   </div>
                   
                   {/* VISUALIZAÇÃO DE ARQUIVOS LOCAIS */}
                   {localFiles.length > 0 && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                           {localFiles.map((ev, idx) => (
                               <div key={ev.id} className="bg-white border border-slate-200 p-2 rounded-lg text-sm flex items-center shadow-sm">
                                   <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center mr-3 overflow-hidden shrink-0">
                                       {ev.type === 'image' ? (
                                           <img src={ev.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                       ) : ev.type === 'video' ? (
                                           <Video size={18} className="text-slate-400" />
                                       ) : (
                                           <FileText size={18} className="text-slate-400" />
                                       )}
                                   </div>
                                   <span className="truncate flex-1 mr-2 text-xs font-medium text-slate-600">
                                       {ev.name}
                                   </span>
                                   <button onClick={() => removeAttachment(idx)} className="text-red-500 bg-red-50 p-1.5 rounded-full hover:bg-red-100 transition"><X size={14}/></button>
                               </div>
                           ))}
                       </div>
                   )}
                   {localFiles.length > 0 && (
                       <p className="text-[10px] text-purple-600 bg-purple-50 p-2 rounded border border-purple-100 flex items-center">
                           <Eye size={12} className="mr-1"/> Estes {localFiles.length} arquivos serão analisados pela IA na geração do documento.
                       </p>
                   )}
              </div>
          );
          case 3: return (
              <div className="pb-12">
                  {partiesStep === 'role_selection' ? (
                       <div className="flex flex-col items-center justify-center py-10 animate-fade-in">
                           <h3 className="text-xl font-bold text-slate-800 mb-8">Quem está preenchendo esta notificação?</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                               <button 
                                   onClick={() => {setRole('self'); setPartiesStep('forms');}} 
                                   className="p-8 border-2 border-slate-100 rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition group text-left relative overflow-hidden"
                               >
                                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                                       <Users size={64} className="text-blue-600" />
                                   </div>
                                   <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                       <UserCheck size={24} />
                                   </div>
                                   <h4 className="text-lg font-bold text-slate-800 mb-2">Pessoa Física (CPF)</h4>
                                   <p className="text-sm text-slate-500">Para notificações em seu próprio nome. (Uso exclusivo de CPF)</p>
                               </button>

                               <button 
                                   onClick={() => {setRole('representative'); setPartiesStep('forms');}} 
                                   className="p-8 border-2 border-slate-100 rounded-2xl hover:bg-purple-50 hover:border-purple-200 transition group text-left relative overflow-hidden"
                               >
                                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                                       <Briefcase size={64} className="text-purple-600" />
                                   </div>
                                   <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                       <UserCog size={24} />
                                   </div>
                                   <h4 className="text-lg font-bold text-slate-800 mb-2">Representante / Empresa</h4>
                                   <p className="text-sm text-slate-500">Para Advogados, Procuradores ou notificações de Empresas (CNPJ).</p>
                               </button>
                           </div>
                       </div>
                   ) : (
                       <div className="space-y-6 animate-fade-in">
                           <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                               <div className="flex items-center gap-2">
                                   <span className="p-1.5 bg-white rounded-md border border-slate-200 shadow-sm">
                                       {role === 'self' ? <UserCheck size={16} className="text-blue-600"/> : <UserCog size={16} className="text-purple-600"/>}
                                   </span>
                                   <span className="text-sm text-slate-600">
                                       Modo: <strong className="text-slate-900">{role === 'self' ? 'Próprio Notificante' : 'Representante Legal'}</strong>
                                   </span>
                               </div>
                               <button 
                                   onClick={() => setPartiesStep('role_selection')} 
                                   className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
                               >
                                   Alterar Seleção
                               </button>
                           </div>

                           {role === 'representative' && (
                               <PersonForm 
                                   title="Dados do Representante (Advogado/Procurador)" 
                                   data={formData.representative} 
                                   section="representative" 
                                   colorClass="border-purple-500" 
                                   onInputChange={handleInputChange} 
                                   onAddressChange={handleAddressChange}
                                   documentLabel="CPF"
                                   documentPlaceholder="Seu CPF"
                                   documentMask={MASKS.cpf}
                                   documentMaxLength={14}
                               />
                           )}
                           
                           <PersonForm 
                               title={role === 'representative' ? "Dados do Cliente (Notificante)" : "Dados do Notificante"} 
                               data={formData.sender} 
                               section="sender" 
                               colorClass="border-blue-500" 
                               onInputChange={handleInputChange} 
                               onAddressChange={handleAddressChange}
                               documentLabel="CPF"
                               documentMask={role === 'self' ? MASKS.cpf : MASKS.cpfCnpj}
                               documentMaxLength={role === 'self' ? 14 : 18}
                               documentPlaceholder={role === 'self' ? "Seu CPF" : "Ou CNPJ"}
                           />
                           
                           <PersonForm 
                               title="Dados do Notificado" 
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
          case 4: return (
              <div className="flex flex-col gap-6 pb-12 h-auto min-h-[500px] relative">
                  
                  {/* LOCK OVERLAY IF SIGNED */}
                  {formData.signed && (
                      <div className="absolute inset-0 bg-slate-200/60 backdrop-blur-sm z-30 rounded-xl flex items-center justify-center animate-fade-in">
                          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center max-w-sm">
                              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                  <Lock size={32} />
                              </div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">Documento Assinado</h3>
                              <p className="text-slate-500 text-sm mb-6">
                                  O conteúdo está bloqueado para preservar a integridade da assinatura digital.
                              </p>
                              <button 
                                onClick={unlockForEditing}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition flex items-center justify-center"
                              >
                                  <Unlock size={16} className="mr-2" /> Destrancar para Editar
                              </button>
                              <p className="text-xs text-red-400 mt-3 font-medium">Atenção: A assinatura atual será removida.</p>
                          </div>
                      </div>
                  )}

                  {/* AGENDAMENTO E IA CONFIG (Topo) */}
                  <div className={`bg-slate-900 text-white p-6 rounded-xl shrink-0 transition-opacity ${formData.signed ? 'opacity-30' : 'opacity-100'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold">Geração Inteligente (IA)</h4>
                        <Wand2 className="text-purple-400" />
                      </div>
                      
                      {/* LÓGICA DE AGENDAMENTO */}
                      <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
                          <label className={`flex items-center gap-3 cursor-pointer mb-4 ${formData.signed ? 'pointer-events-none' : ''}`}>
                              <div className="relative inline-flex items-center">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={formData.scheduleMeeting}
                                    onChange={() => setFormData(p => ({...p, scheduleMeeting: !p.scheduleMeeting}))}
                                    disabled={formData.signed}
                                />
                                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                              </div>
                              <span className="text-sm font-medium text-slate-200">Agendar reunião de conciliação por videoconferência?</span>
                          </label>

                          {formData.scheduleMeeting && (
                              <div className="animate-slide-in-down space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Data (Seg-Sex)</label>
                                          <div className="relative">
                                              <Calendar className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                                              <input 
                                                  type="date" 
                                                  value={formData.meetingDate}
                                                  onChange={handleDateChange}
                                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 pl-8 pr-2 text-sm text-white focus:ring-1 focus:ring-purple-400 outline-none"
                                                  disabled={formData.signed}
                                              />
                                          </div>
                                      </div>
                                      <div>
                                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Horário (08h-16h)</label>
                                          <div className="relative">
                                              <Clock className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                                              <select 
                                                  value={formData.meetingTime}
                                                  onChange={e => setFormData(p => ({...p, meetingTime: e.target.value}))}
                                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 pl-8 pr-2 text-sm text-white focus:ring-1 focus:ring-purple-400 outline-none appearance-none"
                                                  disabled={formData.signed}
                                              >
                                                  <option value="">Selecione</option>
                                                  {[8,9,10,11,13,14,15,16].map(h => (
                                                      <option key={h} value={`${h < 10 ? '0'+h : h}:00`}>{`${h < 10 ? '0'+h : h}:00`}</option>
                                                  ))}
                                              </select>
                                          </div>
                                      </div>
                                  </div>
                                  {error && formData.scheduleMeeting && <p className="text-red-400 text-xs mt-1">{error}</p>}
                                  <div className="flex items-center text-xs text-purple-300 bg-purple-500/10 p-2 rounded border border-purple-500/30">
                                      <Video size={12} className="mr-2" />
                                      <span>Link Google Meet será gerado automaticamente.</span>
                                  </div>
                              </div>
                          )}
                      </div>

                      <p className="text-slate-400 text-xs mb-4">A IA analisará os fatos e gerará uma minuta com base na legislação vigente e no percurso selecionado.</p>
                      <button 
                        onClick={generateContent} 
                        disabled={isGenerating || formData.signed} 
                        className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold flex justify-center items-center transition shadow-lg shadow-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <Wand2 className="mr-2"/>} {formData.generatedContent && !showSuccessScreen ? 'Regerar Minuta' : 'Gerar Notificação com IA'}
                      </button>
                  </div>
                  
                  {/* ÁREA DINÂMICA: SUCESSO OU EDITOR */}
                  <div className={`flex-1 min-h-[400px] rounded-xl border transition-all relative overflow-hidden ${formData.signed ? 'opacity-50' : 'opacity-100'} ${showSuccessScreen ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                      
                      {showSuccessScreen && formData.generatedContent ? (
                          // TELA DE SUCESSO ANIMADA (Substitui o editor)
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                              <div className="mb-6 relative">
                                  <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                                  <div className="relative bg-white p-4 rounded-full border-4 border-blue-50 shadow-lg">
                                      <CheckCircle2 size={64} className="text-green-500" />
                                  </div>
                              </div>
                              
                              <h3 className="text-2xl font-bold text-slate-800 mb-2">Documento Gerado com Sucesso!</h3>
                              <p className="text-slate-500 text-sm max-w-md mb-8 leading-relaxed">
                                  A inteligência artificial processou seus dados e criou a minuta jurídica completa. O texto está pronto para ser revisado e assinado na próxima etapa.
                              </p>

                              <div className="flex flex-col w-full max-w-sm gap-3">
                                  <button 
                                      onClick={() => { setCurrentStep(5); window.scrollTo(0,0); }}
                                      className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition transform hover:scale-105 flex items-center justify-center"
                                  >
                                      Revisar e Assinar <ArrowRight className="ml-2" size={18} />
                                  </button>
                                  
                                  <button 
                                      onClick={() => setShowSuccessScreen(false)}
                                      className="text-xs text-slate-400 hover:text-slate-600 font-medium mt-2 underline"
                                  >
                                      Visualizar ou editar manualmente agora
                                  </button>
                              </div>
                          </div>
                      ) : (
                          // EDITOR PADRÃO (Para visualização manual se o usuário optar por editar ou antes da geração)
                          <textarea 
                            value={formData.generatedContent} 
                            onChange={e => setFormData(p=>({...p, generatedContent: e.target.value}))} 
                            className="w-full h-full bg-transparent resize-none outline-none font-serif text-sm leading-relaxed text-slate-800 disabled:cursor-not-allowed p-6" 
                            placeholder={isGenerating ? "Aguarde, a IA está escrevendo seu documento..." : "O texto da notificação aparecerá aqui após a geração."}
                            disabled={formData.signed || isGenerating}
                          />
                      )}
                  </div>
              </div>
          );
          case 5: return (
              <div className="pb-12 text-center animate-fade-in">
                   <div className="flex items-center justify-center mb-6">
                       <h3 className="text-xl font-bold text-slate-800">Revisão e Assinatura</h3>
                   </div>
                   
                   {/* DOCUMENT PREVIEW CONTAINER */}
                   <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 border border-slate-200 shadow-xl rounded-sm text-left h-[500px] overflow-y-auto mb-8 relative">
                       {/* Watermark-like background */}
                       <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                           <Scale size={200} />
                       </div>
                       
                       <div className="font-serif text-slate-800 text-sm leading-7 whitespace-pre-wrap relative z-10">
                           {formData.generatedContent}
                       </div>
                       
                       {formData.signed && signatureData && (
                           <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col items-center relative z-10">
                               <img src={signatureData} alt="Assinatura" className="h-16 object-contain mb-2" />
                               <div className="border-t border-slate-800 w-64 mb-2"></div>
                               <p className="font-bold text-slate-900 uppercase text-xs tracking-wider">{formData.sender.name}</p>
                               
                               <div className="mt-6 flex flex-col items-center bg-slate-50 px-4 py-2 rounded border border-slate-100">
                                   <div className="text-[10px] text-slate-400 font-mono text-center">
                                       <p className="mb-1"><strong>ID DO DOCUMENTO:</strong> {notificationId}</p>
                                       <p><strong>HASH DE INTEGRIDADE:</strong> {btoa(notificationId + formData.sender.cpfCnpj).substring(0, 32)}...</p>
                                   </div>
                                   <p className="text-green-600 flex items-center justify-center mt-2 gap-1 text-[10px] font-bold uppercase"><ShieldCheck size={12} /> Documento assinado eletronicamente</p>
                               </div>
                           </div>
                       )}
                   </div>

                   {!formData.signed && (
                       <div className="w-full max-w-md mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                           <div className="flex justify-between items-center mb-3">
                               <p className="text-xs font-bold text-slate-500 uppercase flex items-center"><PenTool size={12} className="mr-1"/> Assine no quadro abaixo</p>
                               <button onClick={clearSignature} className="text-red-500 text-xs hover:underline font-medium">Limpar</button>
                           </div>
                           <div ref={containerRef} className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none mb-4 relative cursor-crosshair hover:border-slate-400 transition-colors">
                               <canvas 
                                ref={canvasRef} 
                                height={160} 
                                onMouseDown={startDrawing} 
                                onMouseMove={draw} 
                                onMouseUp={stopDrawing} 
                                onMouseLeave={stopDrawing} 
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full block" 
                                style={{touchAction: 'none'}}
                               />
                               {!isDrawing && !signatureData && (
                                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                       <span className="text-4xl text-slate-300 font-handwriting select-none">Assinar Aqui</span>
                                   </div>
                               )}
                           </div>
                           <div className="flex gap-3">
                               <button 
                                onClick={confirmSignature} 
                                className="w-full py-3 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 shadow-lg transition-transform active:scale-95 flex items-center justify-center"
                               >
                                   <Check size={18} className="mr-2" />
                                   Confirmar Assinatura
                               </button>
                           </div>
                       </div>
                   )}
              </div>
          );
          case 6: 
             // STAGE 1: PLAN SELECTION
             if (paymentStage === 'selection') return (
                 <div className="pb-12 space-y-6 animate-fade-in">
                     <div className="text-center mb-8">
                         <h3 className="text-2xl font-bold text-slate-800">Escolha como prosseguir</h3>
                         <p className="text-slate-500 text-sm">Selecione o plano ideal para sua necessidade jurídica.</p>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {/* PLANO AVULSO */}
                        <div onClick={() => setPaymentPlan('single')} className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${paymentPlan==='single' ? 'bg-white ring-2 ring-blue-500 shadow-xl scale-[1.02]' : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg'}`}>
                             {paymentPlan === 'single' && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">SELECIONADO</div>}
                             
                             <div className="flex flex-col h-full">
                                 <div className="mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${paymentPlan==='single' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Send size={28} />
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-xl">Envio Avulso</h4>
                                    <p className="text-sm text-slate-500 mt-1">Combo Digital Completo</p>
                                 </div>
                                 
                                 <div className="mb-8">
                                    <p className="text-4xl font-bold text-slate-900 tracking-tight">R$ 57,92</p>
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mt-1">pagamento único</p>
                                 </div>

                                 <div className="space-y-3 pt-6 border-t border-slate-100 mt-auto">
                                     {[
                                         'Envio Imediato via WhatsApp',
                                         'Envio via SMS Certificado',
                                         'Envio via E-mail com Rastreio',
                                         'Certificado de Entrega Digital'
                                     ].map((feat, i) => (
                                         <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                                             <div className="p-0.5 rounded-full bg-green-100 text-green-600"><Check size={10} /></div>
                                             {feat}
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>

                        {/* PLANO ASSINATURA */}
                        <div onClick={() => setPaymentPlan('subscription')} className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${paymentPlan==='subscription' ? 'bg-slate-900 ring-2 ring-purple-500 shadow-2xl scale-[1.02]' : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-lg'}`}>
                             {paymentPlan === 'subscription' && <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-sm flex items-center"><ZapIcon size={10} className="mr-1 text-yellow-300" /> RECOMENDADO</div>}
                             
                             <div className="flex flex-col h-full">
                                 <div className="mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${paymentPlan==='subscription' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-100 text-slate-400'}`}>
                                        <Package size={28} />
                                    </div>
                                    <h4 className={`font-bold text-xl ${paymentPlan==='subscription' ? 'text-white' : 'text-slate-900'}`}>Assinatura Pro</h4>
                                    <p className={`text-sm mt-1 ${paymentPlan==='subscription' ? 'text-slate-400' : 'text-slate-500'}`}>Para advogados e empresas</p>
                                 </div>
                                 
                                 <div className="mb-8">
                                    <p className={`text-4xl font-bold tracking-tight ${paymentPlan==='subscription' ? 'text-white' : 'text-slate-900'}`}>R$ 259,97 <span className="text-sm font-normal opacity-60">/mês</span></p>
                                    <p className={`text-xs font-bold uppercase tracking-wide mt-1 ${paymentPlan==='subscription' ? 'text-purple-400' : 'text-purple-600'}`}>~R$ 26,00 por notificação</p>
                                 </div>

                                 <div className={`space-y-3 pt-6 border-t mt-auto ${paymentPlan==='subscription' ? 'border-slate-700' : 'border-slate-100'}`}>
                                     <div className={`flex items-center gap-3 text-sm ${paymentPlan==='subscription' ? 'text-slate-300' : 'text-slate-600'}`}>
                                         <div className="p-0.5 rounded-full bg-purple-500/20 text-purple-400"><Check size={10} /></div>
                                         <strong>10 Créditos</strong> de envio mensal
                                     </div>
                                     <div className={`flex items-center gap-3 text-sm ${paymentPlan==='subscription' ? 'text-slate-300' : 'text-slate-600'}`}>
                                         <div className="p-0.5 rounded-full bg-purple-500/20 text-purple-400"><Check size={10} /></div>
                                         Créditos cumulativos (30 dias)
                                     </div>
                                     <div className={`flex items-center gap-3 text-sm ${paymentPlan==='subscription' ? 'text-slate-300' : 'text-slate-600'}`}>
                                         <div className="p-0.5 rounded-full bg-purple-500/20 text-purple-400"><Check size={10} /></div>
                                         Suporte prioritário via WhatsApp
                                     </div>
                                 </div>
                             </div>
                        </div>
                     </div>
                     
                     <div className="max-w-md mx-auto pt-6">
                         <div className="flex items-center justify-between py-4 border-t border-slate-100 mb-4">
                             <div className="text-sm text-slate-500 font-medium">Total a pagar agora:</div>
                             <div className="text-right font-bold text-3xl text-slate-900">R$ {calculateTotal().toFixed(2)}</div>
                         </div>

                         <button onClick={() => setPaymentStage('input')} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl shadow-slate-200 flex items-center justify-center hover:bg-slate-800 transition transform hover:scale-105 active:scale-95 group">
                             Ir para Pagamento <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                         </button>
                     </div>
                 </div>
             );
             
             // STAGE 2: PAYMENT INPUT
             if (paymentStage === 'input') return (
                <div className="pb-12 max-w-md mx-auto animate-fade-in">
                    <button 
                        onClick={() => setPaymentStage('selection')}
                        className="mb-6 text-slate-400 hover:text-slate-600 flex items-center text-sm font-medium transition-colors"
                    >
                        <ChevronLeft size={16} className="mr-1" /> Voltar para planos
                    </button>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-100">
                        <div className="text-center mb-6">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                            <p className="text-3xl font-bold text-slate-900">R$ {calculateTotal().toFixed(2)}</p>
                        </div>

                        <div className="flex bg-slate-50 p-1 rounded-xl mb-6 border border-slate-100">
                            <button 
                                onClick={() => setPaymentMethod('pix')}
                                className={`flex-1 py-2.5 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${paymentMethod === 'pix' ? 'bg-white text-green-700 shadow-sm ring-1 ring-green-500/20' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <QrCode size={16} className="mr-2" /> Pix
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('credit_card')}
                                className={`flex-1 py-2.5 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${paymentMethod === 'credit_card' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-500/20' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <CardIcon size={16} className="mr-2" /> Cartão
                            </button>
                        </div>

                        {paymentMethod === 'pix' ? (
                            <div className="text-center space-y-5 animate-fade-in">
                                <div className="p-4 bg-white border-2 border-slate-100 rounded-xl inline-block shadow-inner relative group">
                                    <QrCode size={160} className="text-slate-800 opacity-90 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-white/80 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-slate-900">Scan Me</div>
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-center">
                                        <Copy size={12} className="mr-1" /> Código Pix Copia e Cola
                                    </p>
                                    <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden group hover:border-blue-300 transition-colors">
                                        <input 
                                            readOnly 
                                            value="00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913NOTIFY SERVICOS6009SAO PAULO62070503***6304E2CA"
                                            className="bg-transparent text-xs text-slate-600 w-full outline-none truncate font-mono px-3 py-3"
                                        />
                                        <button 
                                            onClick={handleCopyPix}
                                            className={`p-3 transition-colors ${pixCopied ? 'bg-green-500 text-white' : 'bg-white border-l border-slate-200 text-blue-600 hover:bg-blue-50'}`}
                                            title="Copiar"
                                        >
                                            {pixCopied ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <p className={`text-[10px] mt-2 transition-colors font-medium ${pixCopied ? 'text-green-600' : 'text-slate-400'}`}>
                                        {pixCopied ? 'Código copiado com sucesso!' : 'Aguardando confirmação automática...'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Número do Cartão</label>
                                    <div className="relative">
                                        <CardIcon className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="0000 0000 0000 0000" 
                                            maxLength={19}
                                            value={cardData.number}
                                            onChange={e => setCardData(p => ({...p, number: MASKS.card(e.target.value)}))}
                                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-mono focus:ring-2 focus:ring-blue-100 transition focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nome no Cartão</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="COMO NO CARTÃO" 
                                            value={cardData.name}
                                            onChange={e => setCardData(p => ({...p, name: e.target.value.toUpperCase()}))}
                                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-100 transition focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Validade</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-3 text-slate-400" size={16} />
                                            <input 
                                                type="text" 
                                                placeholder="MM/AA" 
                                                maxLength={5}
                                                value={cardData.expiry}
                                                onChange={e => setCardData(p => ({...p, expiry: MASKS.expiry(e.target.value)}))}
                                                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-100 transition focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">CVV</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                                            <input 
                                                type="text" 
                                                placeholder="123" 
                                                maxLength={4}
                                                value={cardData.cvv}
                                                onChange={e => setCardData(p => ({...p, cvv: e.target.value.replace(/\D/g,'')}))}
                                                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-100 transition focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleConfirmPayment} 
                        disabled={isProcessingPayment}
                        className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl shadow-slate-200 flex items-center justify-center hover:bg-slate-800 transition transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isProcessingPayment ? <Loader2 className="animate-spin mr-2"/> : <Check size={20} className="mr-2" />}
                        {isProcessingPayment ? 'Processando...' : `Confirmar Pagamento`}
                    </button>
                    
                    {/* Botão Pagar Depois */}
                    <button 
                        onClick={handlePayLater}
                        disabled={isProcessingPayment}
                        className="w-full mt-3 bg-transparent text-slate-500 py-2 text-xs font-bold hover:text-slate-800 transition uppercase tracking-wide"
                    >
                        Pagar depois e salvar pendência
                    </button>
                </div>
             );

             // STAGE 3: PROTOCOL & SUCCESS
             if (paymentStage === 'protocol') return (
                 <div className="pb-12 max-w-lg mx-auto text-center animate-fade-in">
                     <div className="relative inline-block mb-8 mt-4">
                         <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-50"></div>
                         <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl border-4 border-white">
                             <CheckCircle2 size={48} />
                         </div>
                     </div>
                     
                     <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Sucesso!</h2>
                     <p className="text-slate-500 mb-10 max-w-xs mx-auto leading-relaxed">Sua notificação foi processada e registrada com segurança.</p>

                     <div className="bg-white rounded-2xl border border-slate-200 shadow-lg text-left mb-8 relative overflow-hidden group hover:border-blue-200 transition-colors">
                         {/* Receipt jagged edge effect - simulated with CSS or simple border */}
                         <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
                         
                         <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest Protocolo Digital">Protocolo Digital</h4>
                                <div className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200 uppercase">Confirmado</div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">ID da Transação</span>
                                    <span className="text-sm font-mono font-bold text-slate-800 select-all">{createdData.trans?.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Notificação ID</span>
                                    <span className="text-sm font-mono font-bold text-slate-800 select-all">{createdData.notif?.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Data de Emissão</span>
                                    <span className="text-sm text-slate-800 font-medium">{new Date().toLocaleDateString()}</span>
                                </div>
                                {createdData.meet && (
                                    <div className="flex justify-between pt-2 border-t border-dashed border-slate-100 mt-2">
                                        <span className="text-sm text-purple-600 font-bold flex items-center"><Video size={12} className="mr-1"/> Reunião Criada</span>
                                        <span className="text-sm text-slate-800">{createdData.meet.date.split('-').reverse().join('/')}</span>
                                    </div>
                                )}
                            </div>
                         </div>
                         <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                             <p className="text-[10px] text-slate-400">Este comprovante foi enviado para seu e-mail.</p>
                         </div>
                     </div>

                     <div className="space-y-3">
                         <button 
                             onClick={handleFinishProtocol}
                             className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl shadow-slate-300 flex items-center justify-center hover:bg-slate-800 transition transform active:scale-95 group"
                         >
                             Voltar ao Painel de Controle <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform"/>
                         </button>
                     </div>
                 </div>
             );
      }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 relative">
       {/* LOADER DE SALVAMENTO BLOQUEANTE */}
       {isSavingData && (
           <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur flex flex-col items-center justify-center animate-fade-in">
               <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
               <h3 className="text-lg font-bold text-slate-800">Processando</h3>
               <p className="text-slate-500 text-sm">Salvando notificação na aba pendentes...</p>
           </div>
       )}

       {/* Responsive Scrollable Steps Bar */}
       <div className="bg-white p-2 md:p-4 rounded-xl border shadow-sm mb-6 sticky top-0 z-20">
           <div className="flex overflow-x-auto gap-2 md:gap-0 md:justify-between scrollbar-hide snap-x py-1">
               {STEPS.map(step => (
                   <div key={step.id} className={`flex flex-col items-center min-w-[70px] md:min-w-0 snap-center shrink-0 transition-colors duration-300 ${currentStep >= step.id ? 'text-blue-600' : 'text-slate-300'}`}>
                       <div className={`p-2 rounded-full mb-1 transition-all ${currentStep === step.id ? 'bg-blue-100 ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                           <step.icon size={18} />
                       </div>
                       <span className={`text-[10px] font-bold uppercase ${currentStep === step.id ? 'text-blue-700' : ''}`}>{step.label}</span>
                   </div>
               ))}
           </div>
       </div>

       <div className="bg-white p-4 md:p-8 rounded-2xl border shadow-sm min-h-[500px] flex flex-col relative">
           <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
               <h2 className="text-xl md:text-2xl font-bold text-slate-800">{STEPS[currentStep-1].label}</h2>
               {error && <span className="text-red-500 text-xs md:text-sm font-bold bg-red-50 px-3 py-1 rounded-full animate-pulse flex items-center"><AlertTriangle size={14} className="mr-1"/> {error}</span>}
           </div>
           
           <div className="flex-1">
               {renderStepContent()}
           </div>
       </div>

       {paymentStage !== 'protocol' && (
           <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t p-4 z-30 md:pl-72 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => {
                        if (currentStep > 1) {
                            if (paymentStage === 'input') {
                                setPaymentStage('selection');
                            } else {
                                setCurrentStep(c => c - 1);
                                window.scrollTo(0,0);
                            }
                        } else {
                            // VOLTA PARA O PAINEL SE FOR ETAPA 1
                            if (onBack) onBack();
                        }
                    }} 
                    className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                    Voltar
                </button>
                
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                    Passo {currentStep} de {STEPS.length}
                </div>

                {currentStep < 6 && (
                    <button onClick={handleNext} disabled={isSavingData} className="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg shadow-slate-300 transition transform active:scale-95 disabled:opacity-50">
                        {currentStep === 5 ? 'Salvar e Continuar' : 'Continuar'}
                    </button>
                )}
           </div>
       )}
    </div>
  );
};

// Ícone Auxiliar que faltava no import original
function ArrowRightIcon(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );
}

export default NotificationCreator;