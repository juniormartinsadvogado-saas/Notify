import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadEvidence, deleteEvidence, uploadSignedPdf } from '../services/notificationService';
import { initiateCheckout } from '../services/paymentService';
import { createMeeting } from '../services/meetingService'; // Import para persistir reunião
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Wand2, Scale, Users, 
  FileText, PenTool, CreditCard, Check, Loader2, 
  AlertCircle, Briefcase, ShoppingBag, Home, Heart, Gavel, Globe,
  Building2, Calculator, Landmark, Stethoscope, Leaf, Anchor, Plane, Zap, Rocket, Laptop, Trophy, FileSignature, Scroll, UploadCloud, X, MapPin, UserCheck, UserCog, ExternalLink, ChevronDown, Calendar, Clock, Video, User, ShieldCheck, Download, Clock3, MessageCircle, Smartphone, Mail, Package, ZapIcon, Send, Lock, Unlock
} from 'lucide-react';

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
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

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
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

  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
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

  const saveDraftState = async (evidencesOverride?: EvidenceItem[]) => {
     if (!user) return;
     
     const currentEvidences = evidencesOverride || evidences;
     const validEvidences = currentEvidences.filter(e => !e.isLoading);

     const draft: NotificationItem = {
         id: notificationId,
         senderUid: user.uid,
         senderName: formData.sender.name || user.displayName || 'Desconhecido',
         senderEmail: formData.sender.email || user.email || '',
         senderPhotoUrl: user.photoURL,
         recipientName: formData.recipient.name,
         recipientEmail: formData.recipient.email,
         recipientCpf: formData.recipient.cpfCnpj.replace(/\D/g, ''),
         area: currentArea?.name || '',
         species: formData.species,
         facts: formData.facts,
         subject: formData.subject || formData.species,
         content: formData.generatedContent,
         evidences: validEvidences, 
         createdAt: new Date().toISOString(),
         status: NotificationStatus.DRAFT,
     };
     await saveNotification(draft);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setIsUploadingFile(true);
        const file = e.target.files[0];
        const tempId = `temp-${Date.now()}`;

        const tempEvidence: EvidenceItem = {
            id: tempId,
            name: file.name,
            url: '',
            type: file.type.startsWith('image/') ? 'image' : 'document',
            storagePath: '',
            createdAt: new Date().toISOString(),
            isLoading: true 
        };

        setEvidences(prev => [...prev, tempEvidence]);

        try {
            // Upload simulado funciona mesmo no modo demo
            const newEvidence = await uploadEvidence(notificationId, file);
            
            const updatedList = [...evidences, newEvidence];
            
            setEvidences(prev => prev.map(ev => ev.id === tempId ? newEvidence : ev));
            await saveDraftState(updatedList); 
        } catch (err) {
            console.error(err);
            setError("Erro ao fazer upload do arquivo. Verifique sua conexão.");
            setEvidences(prev => prev.filter(ev => ev.id !== tempId));
        } finally {
            setIsUploadingFile(false);
            e.target.value = ''; 
        }
    }
  };

  const removeAttachment = async (index: number) => {
    const evidence = evidences[index];
    
    if (evidence.isLoading) {
        setEvidences(prev => prev.filter((_, i) => i !== index));
        return;
    }

    try {
        await deleteEvidence(evidence.storagePath);
        const updatedList = evidences.filter((_, i) => i !== index);
        setEvidences(updatedList);
        await saveDraftState(updatedList);
    } catch (err) {
        console.error(err);
        setError("Erro ao remover arquivo.");
    }
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
    await saveDraftState();

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
    if (currentStep === 5 && !formData.signed) return setError('Você precisa assinar o documento.');

    if (currentStep < STEPS.length) {
      setCurrentStep(curr => curr + 1);
      window.scrollTo(0,0);
    }
  };

  const generateContent = async () => {
    // MODIFICAÇÃO: Removida a validação bloqueante.
    // O usuário solicitou que a geração ocorra independente dos dados de agendamento estarem completos.
    
    setIsGenerating(true);
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
          // Caso esteja marcado mas sem dados, avisamos visualmente mas geramos o texto sem o agendamento
          setError("Aviso: Texto gerado sem dados de agendamento (Data/Hora não preenchidos).");
      }

      // Preparar arquivos para a IA
      const currentAttachments: Attachment[] = [];
      if (evidences && evidences.length > 0) {
          for (const ev of evidences) {
              try {
                  // Como é ambiente simulado, ev.url é um blob url local
                  const response = await fetch(ev.url);
                  const blob = await response.blob();
                  const file = new File([blob], ev.name, { type: blob.type });
                  
                  // Aceita imagens e PDFs
                  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                      currentAttachments.push({
                          file: file,
                          preview: ev.url,
                          type: file.type.startsWith('image/') ? 'image' : 'document'
                      });
                  }
              } catch (e) {
                  console.warn("Could not prepare file for AI", ev.name, e);
              }
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
    } catch (err: any) {
      console.error(err);
      // Mostra mensagem de erro real se disponível para ajudar na depuração (Ex: API Key Missing)
      setError(err.message || 'Erro ao gerar texto: Verifique sua conexão.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePayLater = async () => {
    setIsProcessingPayment(true);
    setError('');
    
    try {
        if(!user) return;
        const pdfContent = `DOC: ${notificationId}\n...\n${formData.generatedContent}\n...`; // Mock
        const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
        const pdfUrl = await uploadSignedPdf(notificationId, pdfBlob);

        const totalAmount = calculateTotal();
        
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
            evidences: evidences,
            pdfUrl: pdfUrl,
            signatureBase64: signatureData || undefined, // Salva a assinatura
            createdAt: new Date().toISOString(),
            status: NotificationStatus.PENDING_PAYMENT,
            paymentMethod,
            paymentAmount: totalAmount
        };

        // Salvar como PENDING_PAYMENT
        await saveNotification(finalNotification);

        // Cria Transação como PENDENTE
        const newTransaction: Transaction = {
            id: `TX-${Date.now()}`,
            description: paymentPlan === 'subscription' ? 'Assinatura Mensal - 10 Créditos' : `Notificação - ${formData.species}`,
            amount: totalAmount,
            date: new Date().toISOString(),
            status: 'Pendente'
        };

        // Cria Reunião como CANCELADA (só ativa ao pagar)
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
                status: 'canceled' // Regra: Cancelada até pagar
            };
            await createMeeting(newMeeting);
        }

        setCreatedData({ notif: finalNotification, meet: newMeeting, trans: newTransaction });
        setPaymentStage('protocol');

    } catch (e) {
        console.error(e);
        setError("Erro ao salvar pendência.");
    } finally {
        setIsProcessingPayment(false);
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
          if(!user) return;
          const pdfContent = `DOC: ${notificationId}\n...\n${formData.generatedContent}\n...`; // Mock
          const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
          const pdfUrl = await uploadSignedPdf(notificationId, pdfBlob);

          const totalAmount = calculateTotal();
          
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
              evidences: evidences,
              pdfUrl: pdfUrl,
              signatureBase64: signatureData || undefined, // Salva a assinatura
              createdAt: new Date().toISOString(),
              status: NotificationStatus.PENDING_PAYMENT,
              paymentMethod,
              paymentAmount: totalAmount
          };

          // Salvar inicialmente como pendente
          await saveNotification(finalNotification);

          // Iniciar tentativa de pagamento
          const checkoutResponse = await initiateCheckout(finalNotification);

          if (!checkoutResponse.success) {
             setError(checkoutResponse.error || "Erro ao iniciar pagamento. Tente novamente.");
             return;
          }

          if (checkoutResponse.checkoutUrl) {
             window.location.href = checkoutResponse.checkoutUrl;
             return;
          }

          // ** LÓGICA DE FINALIZAÇÃO E DISTRIBUIÇÃO **
          
          // Verifica se pagamento foi sucesso (mock assume sim se chegou aqui sem URL de checkout)
          const isPaymentSuccess = true; // Mock para fluxo direto

          // 1. Atualiza Status da Notificação
          if (isPaymentSuccess) {
              finalNotification.status = NotificationStatus.SENT;
              await saveNotification(finalNotification);
          }

          // 2. Cria Transação
          const newTransaction: Transaction = {
              id: `TX-${Date.now()}`,
              description: paymentPlan === 'subscription' ? 'Assinatura Mensal - 10 Créditos' : `Notificação Avulsa - ${formData.species}`,
              amount: totalAmount,
              date: new Date().toISOString(),
              status: isPaymentSuccess ? 'Pago' : 'Pendente'
          };

          // 3. Cria Reunião (Se agendada)
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
                  // REGRA DE NEGÓCIO: Se pagamento pendente/falha, conciliação é CANCELADA.
                  status: isPaymentSuccess ? 'scheduled' : 'canceled' 
              };
              await createMeeting(newMeeting);
          }

          // ARMAZENA DADOS PARA O BOTÃO FINAL
          setCreatedData({ notif: finalNotification, meet: newMeeting, trans: newTransaction });

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

  const generateProtocolPDF = () => {
      // Simulação simples de geração de PDF usando janela de impressão
      if (!createdData.notif) return;
      
      const win = window.open('', '_blank');
      if (win) {
          win.document.write(`
              <html>
              <head>
                  <title>Protocolo Digital - ${createdData.notif.id}</title>
                  <style>
                      body { font-family: sans-serif; padding: 40px; }
                      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                      .content { margin-bottom: 30px; line-height: 1.6; }
                      .box { border: 1px solid #ccc; padding: 15px; background: #f9f9f9; margin-bottom: 20px; }
                      .signature-box { text-align: center; margin-top: 50px; border-top: 1px solid #333; padding-top: 10px; width: 300px; margin-left: auto; margin-right: auto; }
                  </style>
              </head>
              <body>
                  <div class="header">
                      <h1>PROTOCOLO DE REGISTRO</h1>
                      <p>Notify Serviços Jurídicos</p>
                  </div>
                  <div class="content">
                      <p>Este documento certifica que a notificação extrajudicial foi registrada e processada com sucesso em nossa plataforma.</p>
                      
                      <div class="box">
                          <p><strong>Número do Protocolo:</strong> ${createdData.notif.id}</p>
                          <p><strong>Data de Emissão:</strong> ${new Date().toLocaleString()}</p>
                          <p><strong>Status Atual:</strong> ${createdData.notif.status}</p>
                      </div>

                      <h3>Dados do Documento</h3>
                      <p><strong>Remetente:</strong> ${createdData.notif.senderName}</p>
                      <p><strong>Destinatário:</strong> ${createdData.notif.recipientName}</p>
                      <p><strong>Assunto:</strong> ${createdData.notif.species}</p>
                      <hr/>
                      <br/>
                      <div style="font-family: serif; white-space: pre-wrap; font-size: 12px; color: #555;">${createdData.notif.content.substring(0, 500)}... (Resumo do conteúdo)</div>
                  </div>

                  ${createdData.notif.signatureBase64 ? `
                    <div style="text-align: center; margin-top: 60px;">
                        <img src="${createdData.notif.signatureBase64}" style="max-height: 80px;" />
                        <div style="border-top: 1px solid #000; width: 300px; margin: 5px auto 0;"></div>
                        <p><strong>${createdData.notif.senderName}</strong></p>
                        <p style="font-size: 10px; color: #666; margin-top: 5px;">
                            ID: ${createdData.notif.id}<br/>
                            HASH: ${btoa(createdData.notif.id).substring(0, 24)}...
                        </p>
                    </div>
                  ` : ''}
              </body>
              </html>
          `);
          win.document.close();
          win.print();
      }
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
                            {formData.areaId === area.id && (
                                <div className="absolute top-3 right-3">
                                    <span className="flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent flex items-end justify-center pointer-events-none pb-4">
                     <div className="flex flex-col items-center animate-bounce text-slate-400">
                         <span className="text-[10px] font-bold uppercase mb-1 tracking-widest">Mais Opções</span>
                         <ChevronDown size={20} />
                     </div>
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
                        {isUploadingFile ? <Loader2 className="animate-spin mx-auto text-blue-500" /> : <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />}
                        <p className="text-sm text-slate-500 font-medium">{isUploadingFile ? 'Carregando arquivo...' : 'Toque para anexar evidências'}</p>
                        <p className="text-xs text-slate-400">(Fotos, Vídeos, PDF)</p>
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} disabled={isUploadingFile} />
                   </div>
                   {evidences.length > 0 && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                           {evidences.map((ev, idx) => (
                               <div key={ev.id} className="bg-white border border-slate-200 p-3 rounded-lg text-sm flex justify-between items-center shadow-sm">
                                   <span className="truncate flex-1 mr-2 flex items-center">
                                       {ev.isLoading ? (
                                           <Loader2 className="animate-spin mr-2 h-3 w-3 text-blue-500" />
                                       ) : null}
                                       {ev.name}
                                   </span>
                                   {!ev.isLoading && (
                                       <button onClick={() => removeAttachment(idx)} className="text-red-500 bg-red-50 p-1.5 rounded-full hover:bg-red-100 transition"><X size={14}/></button>
                                   )}
                               </div>
                           ))}
                       </div>
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

                  {/* AGENDAMENTO E IA CONFIG */}
                  <div className={`bg-slate-900 text-white p-6 rounded-xl shrink-0 transition-opacity ${formData.signed ? 'opacity-30' : 'opacity-100'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold">IA Generation</h4>
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
                          {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <Wand2 className="mr-2"/>} {formData.generatedContent ? 'Regerar Minuta' : 'Gerar Minuta'}
                      </button>
                  </div>
                  
                  {/* EDITOR */}
                  <div className={`flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[400px] transition-opacity ${formData.signed ? 'opacity-50' : 'opacity-100'}`}>
                      <textarea 
                        value={formData.generatedContent} 
                        onChange={e => setFormData(p=>({...p, generatedContent: e.target.value}))} 
                        className="w-full h-full bg-transparent resize-none outline-none font-serif text-sm leading-relaxed text-slate-800 disabled:cursor-not-allowed" 
                        placeholder="A minuta aparecerá aqui e poderá ser editada..." 
                        disabled={formData.signed}
                      />
                  </div>
              </div>
          );
          case 5: return (
              <div className="pb-12 text-center">
                   <div className="prose prose-sm max-w-none bg-white p-4 md:p-8 border shadow-sm mx-auto text-left h-80 overflow-y-auto mb-6 rounded-xl">
                       {/* MODO LEITURA - ASSINATURA */}
                       <pre className="whitespace-pre-wrap font-serif text-slate-800 text-sm">{formData.generatedContent}</pre>
                       
                       {/* ÁREA DA ASSINATURA FINALIZADA */}
                       {formData.signed && signatureData && (
                           <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col items-center">
                               <img src={signatureData} alt="Assinatura" className="h-20 object-contain mb-2" />
                               <div className="border-t border-black w-64 mb-2"></div>
                               <p className="font-bold text-slate-900 uppercase text-sm">{formData.sender.name}</p>
                               
                               {/* HASH E ID DO DOCUMENTO */}
                               <div className="mt-4 text-[10px] text-slate-400 font-mono text-center bg-slate-50 p-2 rounded border border-slate-100 inline-block">
                                   <p className="mb-1"><strong>ID DO DOCUMENTO:</strong> {notificationId}</p>
                                   <p><strong>HASH DE INTEGRIDADE:</strong> {btoa(notificationId + formData.sender.cpfCnpj).substring(0, 32)}...</p>
                                   <p className="text-green-600 flex items-center justify-center mt-1 gap-1"><ShieldCheck size={10} /> Documento assinado eletronicamente</p>
                               </div>
                           </div>
                       )}
                   </div>

                   {!formData.signed && (
                       <div className="w-full max-w-md mx-auto">
                           <p className="text-sm font-bold text-slate-500 mb-2 uppercase">Assine no quadro abaixo</p>
                           <div ref={containerRef} className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none mb-3">
                               <canvas 
                                ref={canvasRef} 
                                height={180} 
                                onMouseDown={startDrawing} 
                                onMouseMove={draw} 
                                onMouseUp={stopDrawing} 
                                onMouseLeave={stopDrawing} 
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full cursor-crosshair block" 
                                style={{touchAction: 'none'}}
                               />
                           </div>
                           <div className="flex gap-3">
                               <button onClick={clearSignature} className="flex-1 py-2 text-red-500 text-sm font-bold border border-red-100 rounded-lg hover:bg-red-50">Limpar</button>
                               <button onClick={confirmSignature} className="flex-1 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-sm">Confirmar Assinatura</button>
                           </div>
                       </div>
                   )}
              </div>
          );
          case 6: 
             if (paymentStage === 'selection') return (
                 <div className="pb-12 space-y-4">
                     <h3 className="text-xl font-bold text-slate-800 text-center mb-6">Escolha como prosseguir</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* OPÇÃO 1: ENVIO AVULSO */}
                        <div onClick={() => setPaymentPlan('single')} className={`p-6 border-2 rounded-xl cursor-pointer transition relative overflow-hidden group ${paymentPlan==='single' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-200 shadow-lg' : 'border-slate-200 hover:border-blue-200 hover:shadow-md'}`}>
                             {paymentPlan === 'single' && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">SELECIONADO</div>}
                             <div className="flex items-center gap-3 mb-4">
                                <div className={`p-3 rounded-full ${paymentPlan==='single' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Send size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Envio Avulso (Combo Digital)</h4>
                                    <p className="text-xs text-slate-500">Pagamento único por este documento.</p>
                                </div>
                             </div>
                             
                             <div className="mb-4">
                                <p className="text-3xl font-bold text-slate-900">R$ 57,92</p>
                                <p className="text-xs text-slate-400">cobrança única</p>
                             </div>

                             <div className="space-y-2 border-t border-slate-200/50 pt-4">
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Itens Inclusos no Combo:</p>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Check className="text-green-500" size={16} /> Envio via WhatsApp
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Check className="text-green-500" size={16} /> Envio via SMS
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Check className="text-green-500" size={16} /> Envio via E-mail
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Check className="text-green-500" size={16} /> Certificado de Entrega
                                 </div>
                             </div>
                        </div>

                        {/* OPÇÃO 2: ASSINATURA */}
                        <div onClick={() => setPaymentPlan('subscription')} className={`p-6 border-2 rounded-xl cursor-pointer transition relative overflow-hidden group ${paymentPlan==='subscription' ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-200 shadow-lg' : 'border-slate-200 hover:border-purple-200 hover:shadow-md'}`}>
                             {paymentPlan === 'subscription' && <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">MAIS VANTAJOSO</div>}
                             <div className="flex items-center gap-3 mb-4">
                                <div className={`p-3 rounded-full ${paymentPlan==='subscription' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <ZapIcon size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">Assinatura Mensal</h4>
                                    <p className="text-xs text-slate-500">Ideal para advogados e empresas.</p>
                                </div>
                             </div>
                             
                             <div className="mb-4">
                                <p className="text-3xl font-bold text-slate-900">R$ 259,97 <span className="text-sm font-normal text-slate-500">/mês</span></p>
                                <p className="text-xs text-purple-600 font-bold">~R$ 26,00 por envio</p>
                             </div>

                             <div className="space-y-2 border-t border-slate-200/50 pt-4">
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Vantagens Exclusivas:</p>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Package className="text-purple-500" size={16} /> <strong>10 Créditos</strong> de envio mensal
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Clock3 className="text-purple-500" size={16} /> Créditos válidos por 30 dias
                                 </div>
                                 <div className="flex items-center gap-2 text-sm text-slate-700">
                                     <Check className="text-purple-500" size={16} /> Prioridade no suporte
                                 </div>
                                 <div className="mt-2 text-xs bg-purple-100 text-purple-700 p-2 rounded-lg">
                                     Ao assinar, 1 crédito será usado agora e você terá mais <strong>9 créditos</strong> para usar este mês.
                                 </div>
                             </div>
                        </div>
                     </div>
                     
                     <div className="flex items-center justify-between py-4 border-t border-slate-100 mt-4">
                         <div className="text-sm text-slate-500">
                             Total a pagar hoje:
                         </div>
                         <div className="text-right font-bold text-2xl text-slate-900">R$ {calculateTotal().toFixed(2)}</div>
                     </div>

                     <button onClick={() => setPaymentStage('input')} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center hover:bg-slate-800 transition transform active:scale-95">
                         Ir para Pagamento <ArrowRightIcon className="ml-2" size={18} />
                     </button>
                 </div>
             );
      }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24">
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
               {error && <span className="text-red-500 text-xs md:text-sm font-bold bg-red-50 px-3 py-1 rounded-full animate-pulse">{error}</span>}
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
                        }
                    }} 
                    disabled={currentStep===1} 
                    className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-30 transition"
                >
                    Voltar
                </button>
                
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                    Passo {currentStep} de {STEPS.length}
                </div>

                {currentStep < 6 && (
                    <button onClick={handleNext} className="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg shadow-slate-300 transition transform active:scale-95">
                        Continuar
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