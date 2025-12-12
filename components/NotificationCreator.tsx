
import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadEvidence, uploadSignedPdf, confirmPayment } from '../services/notificationService';
import { initiateCheckout, saveTransaction, checkPaymentStatus } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { dispatchCommunications } from '../services/communicationService';
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Wand2, Scale, Users, 
  FileText, PenTool, Check, Loader2, 
  Briefcase, ShoppingBag, Home, Heart, FileSignature, Scroll, UploadCloud, X, User, Video, CheckCircle2, ArrowRight, Calendar, ChevronLeft, Sparkles,
  Gavel, Building2, Landmark, GraduationCap, Wifi, Leaf, Car, Stethoscope, Banknote, Copyright, Key, Globe, QrCode, Copy, AlertCircle, Plane, Zap, Rocket, Monitor, Trophy, Anchor, ShieldCheck, ChevronDown, Lightbulb, Printer, Lock, Send, RefreshCw, Package, ArrowDown, MapPin
} from 'lucide-react';
import { jsPDF } from "jspdf";
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// --- CONSTANTES ---
const STEPS = [
  { id: 1, label: 'Área', icon: Scale },
  { id: 2, label: 'Fatos', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video },
  { id: 5, label: 'Geração', icon: Wand2 },
  { id: 6, label: 'Revisão & Assinatura', icon: FileSignature },
  { id: 7, label: 'Envio', icon: Send }, 
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
    'default': ['Notificação Genérica', 'Solicitação de Documentos', 'Pedido de Esclarecimentos']
};

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
  onBack?: () => void;
}

interface Address {
  cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string;
}

interface LocalAttachment {
    id: string; file: File; previewUrl: string; name: string; type: 'image' | 'video' | 'document';
}

const initialAddress: Address = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };

const MASKS = {
    cpf: (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
    cnpj: (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18),
    cpfCnpj: (v: string) => {
        const d = v.replace(/\D/g, '');
        if (d.length <= 11) return MASKS.cpf(d);
        return MASKS.cnpj(d);
    },
    phone: (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2'),
    cep: (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2')
};

const formatAddressString = (addr: Address) => {
    return `${addr.street}, ${addr.number}${addr.complement ? ' - ' + addr.complement : ''}, ${addr.neighborhood}, ${addr.city}/${addr.state}, CEP: ${addr.cep}`;
};

// --- COMPONENTES AUXILIARES ---

const PersonForm: React.FC<any> = ({ title, data, section, colorClass, onInputChange, onAddressChange, documentLabel = "CPF", documentMask = MASKS.cpf, documentMaxLength = 14, isCompanyAllowed = false }) => (
    <div className={`bg-white p-6 rounded-2xl border-l-4 ${colorClass} shadow-sm border border-slate-200 mb-6`}>
         <h3 className="font-bold text-slate-800 mb-6 flex items-center text-lg">{title}</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo / Razão Social</label>
                <input type="text" value={data.name} onChange={e => onInputChange(section, 'name', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="Nome completo" />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{documentLabel}</label>
                <input type="text" value={data.cpfCnpj} maxLength={documentMaxLength} onChange={e => onInputChange(section, 'cpfCnpj', documentMask(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="000.000.000-00" />
                {!isCompanyAllowed && <span className="text-[10px] text-red-400">Apenas Pessoa Física (CPF) permitido neste campo.</span>}
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                <input type="email" value={data.email} onChange={e => onInputChange(section, 'email', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="email@exemplo.com" />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                <input type="text" value={data.phone} maxLength={15} onChange={e => onInputChange(section, 'phone', MASKS.phone(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="(00) 00000-0000" />
             </div>
         </div>
         <div className="mt-4 pt-4 border-t border-slate-100">
             <span className="text-xs font-bold text-slate-400 uppercase block mb-3 flex items-center"><MapPin size={12} className="mr-1"/> Endereço</span>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input type="text" placeholder="CEP" value={data.address.cep} onChange={e => onAddressChange(section, 'cep', MASKS.cep(e.target.value))} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Rua / Logradouro" value={data.address.street} onChange={e => onAddressChange(section, 'street', e.target.value)} className="col-span-1 md:col-span-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Número" value={data.address.number} onChange={e => onAddressChange(section, 'number', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                {/* CAMPO COMPLEMENTO ADICIONADO */}
                <input type="text" placeholder="Complemento (Apt, Bloco)" value={data.address.complement} onChange={e => onAddressChange(section, 'complement', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Bairro" value={data.address.neighborhood} onChange={e => onAddressChange(section, 'neighborhood', e.target.value)} className="col-span-1 md:col-span-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Cidade" value={data.address.city} onChange={e => onAddressChange(section, 'city', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="UF" value={data.address.state} maxLength={2} onChange={e => onAddressChange(section, 'state', e.target.value.toUpperCase())} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
             </div>
         </div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showAllAreas, setShowAllAreas] = useState(false);
  // ID do documento para Hash
  const [notificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  const [docHash] = useState(Array.from({length: 4}, () => Math.random().toString(36).substr(2, 4).toUpperCase()).join('-'));
  
  // Estado Lógica de Papéis
  const [role, setRole] = useState<'self' | 'representative' | null>(null);
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');

  // Estado Dados
  const [formData, setFormData] = useState({
    areaId: '', species: '', facts: '',
    representative: { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } },
    sender: { name: user?.displayName || '', cpfCnpj: '', email: user?.email || '', phone: '', address: { ...initialAddress } },
    recipient: { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } },
    scheduleMeeting: false, meetingDate: '', meetingTime: '', meetLink: '', subject: '', generatedContent: ''
  });

  const [localFiles, setLocalFiles] = useState<LocalAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false); // Controle visual se foi assinado
  
  // Pagamento & Polling
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<{notif?: NotificationItem, meet?: Meeting, trans?: Transaction}>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const currentArea = LAW_AREAS.find(a => a.id === formData.areaId);
  const availableSubtypes = currentArea ? (AREA_SUBTYPES[currentArea.id] || AREA_SUBTYPES['default']) : [];

  // --- POLLING DE PAGAMENTO ---
  useEffect(() => {
      let interval: any;
      if (currentStep === 8 && asaasPaymentId) {
          interval = setInterval(async () => {
              try {
                  const status = await checkPaymentStatus(asaasPaymentId);
                  if (status.paid) {
                      clearInterval(interval);
                      handlePaymentSuccess();
                  }
              } catch (e) { console.error(e); }
          }, 3000);
      }
      return () => clearInterval(interval);
  }, [currentStep, asaasPaymentId]);

  const handleInputChange = (s: any, f: any, v: any) => setFormData(p => ({ ...p, [s]: { ...p[s], [f]: v } }));
  const handleAddressChange = (s: any, f: any, v: any) => setFormData(p => ({ ...p, [s]: { ...p[s], address: { ...p[s].address, [f]: v } } }));

  // --- 1. SELEÇÃO DE ÁREA ---
  const handleAreaSelect = (id: string) => {
      setFormData(prev => ({ ...prev, areaId: id }));
      setCurrentStep(2);
  };

  // --- 2. FATOS E EVIDÊNCIAS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const file = e.target.files[0];
          setLocalFiles(p => [...p, { id: Math.random().toString(36), file, name: file.name, type: file.type.startsWith('image') ? 'image' : 'document', previewUrl: URL.createObjectURL(file) }]);
      }
  };

  // --- 5. GERAÇÃO IA ---
  const handleGenerateContent = async () => {
      setIsGenerating(true);
      try {
          const attachments: Attachment[] = localFiles.map(lf => ({ file: lf.file, preview: lf.previewUrl, type: lf.type }));
          
          let details = `Fatos: ${formData.facts}\n\n`;
          
          // Lógica de Meeting (O link deve existir na string enviada para a IA)
          if (formData.scheduleMeeting) {
              // LINK FIXO UNIVERSAL
              const link = "https://meet.google.com/yjg-zhrg-rez";
              setFormData(prev => ({...prev, meetLink: link})); // Salva no state para uso posterior
              details += `[DADO CRÍTICO] Foi agendada uma conciliação via Google Meet para ${new Date(formData.meetingDate).toLocaleDateString()} às ${formData.meetingTime}. O Link da sala é: ${link}. INSERIR ESTE LINK NO TEXTO.`;
          }

          const text = await generateNotificationText(
              formData.recipient.name, 
              formData.species, 
              details, 
              'Jurídico Formal', 
              attachments, 
              { area: currentArea?.name || '', species: formData.species, areaDescription: currentArea?.desc || '' }
          );
          
          setFormData(prev => ({ ...prev, generatedContent: text }));
          setCurrentStep(6); // Vai para Revisão e Assinatura
      } catch (e: any) {
          alert("Erro na IA: " + e.message);
      } finally {
          setIsGenerating(false);
      }
  };

  // --- 6. ASSINATURA ---
  const startDrawing = (e: any) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };
  const draw = (e: any) => {
      if (!isDrawing) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          ctx.stroke();
      }
  };
  const endDrawing = () => {
      setIsDrawing(false);
      if (canvasRef.current) setSignatureData(canvasRef.current.toDataURL());
  };
  
  const handleConfirmSignature = async () => {
      if (!signatureData) return alert("Assine para validar o documento.");
      
      // SALVAR COMO PENDENTE IMEDIATAMENTE APÓS ASSINATURA (Backup se sair)
      try {
          const uniqueHash = docHash;
          const pdfUrl = await generateAndUploadPdf(true); // Gera PDF preliminar com assinatura

          const notif: NotificationItem = {
              id: notificationId, documentHash: uniqueHash, notificante_uid: user.uid,
              notificante_cpf: formData.sender.cpfCnpj.replace(/\D/g, ''),
              notificante_dados_expostos: { nome: formData.sender.name, email: formData.sender.email, telefone: formData.sender.phone },
              notificados_cpfs: [formData.recipient.cpfCnpj.replace(/\D/g, '')],
              recipientName: formData.recipient.name, recipientEmail: formData.recipient.email, recipientPhone: formData.recipient.phone,
              recipientDocument: formData.recipient.cpfCnpj, recipientAddress: formatAddressString(formData.recipient.address),
              area: currentArea?.name || '', species: formData.species, facts: formData.facts, subject: formData.species,
              content: formData.generatedContent, evidences: [], pdf_url: pdfUrl, signatureBase64: signatureData,
              createdAt: new Date().toISOString(), status: NotificationStatus.PENDING_PAYMENT, paymentAmount: 57.92
          };
          
          await saveNotification(notif);
          setCreatedData(prev => ({ ...prev, notif }));
          setIsSigned(true);
      } catch (e) {
          console.error("Erro ao salvar rascunho assinado", e);
          alert("Erro ao salvar assinatura. Tente novamente.");
      }
  };

  const handleClearSignature = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setSignatureData(null);
      setIsSigned(false);
  };

  const generateAndUploadPdf = async (isDraft: boolean): Promise<string> => {
      const doc = new jsPDF();
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(formData.generatedContent, 170);
      doc.text(splitText, 20, 20);
      
      if (signatureData) {
          const pageCount = doc.getNumberOfPages();
          doc.setPage(pageCount);
          doc.addImage(signatureData, 'PNG', 80, 250, 50, 20);
          doc.text(`Assinado Digitalmente por ${formData.sender.name}`, 105, 275, { align: 'center' });
          doc.text(`Hash: ${docHash}`, 105, 280, { align: 'center' });
      }
      
      const pdfBlob = doc.output('blob');
      return await uploadSignedPdf(notificationId, pdfBlob);
  };

  // --- 8. INICIAR PAGAMENTO ---
  const handleStartPayment = async () => {
      setIsProcessingPayment(true);
      try {
          if (!createdData.notif) {
              await handleConfirmSignature(); // Garante salvamento se algo falhou
          }

          const notif = createdData.notif!;

          // 3. Salva Meeting se houver
          let meet: Meeting | undefined;
          if (formData.scheduleMeeting) {
              meet = {
                  id: `MEET-${Date.now()}`, hostUid: user.uid, hostName: user.displayName, title: `Conciliação: ${formData.species}`,
                  date: formData.meetingDate, time: formData.meetingTime, guestEmail: formData.recipient.email, 
                  meetLink: formData.meetLink || "https://meet.google.com/yjg-zhrg-rez",
                  createdAt: new Date().toISOString(), status: 'scheduled'
              };
              await createMeeting(meet);
          }

          // 4. Inicia Checkout Asaas
          const checkout = await initiateCheckout(notif, 'single', 'PIX');
          if (checkout.success && checkout.pixData) {
              setPixData(checkout.pixData);
              setAsaasPaymentId(checkout.paymentId || null);
              
              // Salva transação local
              const trans: Transaction = {
                  id: checkout.paymentId || `TX-${Date.now()}`, description: `Notificação - ${formData.species}`,
                  amount: 57.92, date: new Date().toISOString(), status: 'Pendente', notificationId: notif.id, recipientName: formData.recipient.name
              };
              await saveTransaction(user.uid, trans);
              setCreatedData({ notif, meet, trans });
              
              setCurrentStep(8); // Vai para tela de Pagamento
          } else {
              alert("Erro ao gerar Pix: " + checkout.error);
          }

      } catch (e: any) {
          console.error(e);
          alert("Erro no processo de pagamento: " + e.message);
      } finally {
          setIsProcessingPayment(false);
      }
  };

  const handlePaymentSuccess = async () => {
      if (!createdData.notif) return;
      
      // CONFIRMAÇÃO E AUTOMAÇÃO
      try {
          // 1. Atualiza Status
          await confirmPayment(createdData.notif.id);
          const updatedNotif = { ...createdData.notif, status: NotificationStatus.SENT };
          
          // 2. Dispara Automações (Email + Zap)
          await dispatchCommunications(updatedNotif);
          
          setCreatedData(prev => ({...prev, notif: updatedNotif}));
          setCurrentStep(9); // Protocolo
      } catch (e) { 
          console.error("Erro disparo pós-pagamento:", e);
          alert("Pagamento confirmado, mas houve um erro no disparo automático. O sistema tentará novamente.");
          setCurrentStep(9);
      }
  };

  return (
      <div className="max-w-5xl mx-auto pb-24 relative animate-fade-in">
          
          {/* HEADER */}
          <div className="flex items-center mb-8">
              <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-200 rounded-full text-slate-500"><ChevronLeft size={24}/></button>
              <div>
                  <h1 className="text-2xl font-bold text-slate-800">Nova Notificação Extrajudicial</h1>
                  <p className="text-slate-500 text-sm">Crie, valide e envie documentos com validade jurídica.</p>
              </div>
          </div>

          {/* STEPPER */}
          <div className="mb-10 flex overflow-x-auto pb-4 gap-4 px-2">
              {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center min-w-fit">
                      <div className={`flex flex-col items-center ${s.id === currentStep ? 'opacity-100 scale-110' : 'opacity-50'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1 ${s.id <= currentStep ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-300'}`}>
                              {s.id < currentStep ? <Check size={16}/> : <s.icon size={18}/>}
                          </div>
                          <span className="text-[10px] font-bold uppercase">{s.label}</span>
                      </div>
                      {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-slate-200 mx-2"/>}
                  </div>
              ))}
          </div>

          {/* --- STEP 1: ÁREA --- */}
          {currentStep === 1 && (
              <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center"><Scale size={24} className="mr-2 text-blue-600"/> Selecione a Área Jurídica</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {LAW_AREAS.slice(0, showAllAreas ? 20 : 4).map(area => (
                          <button key={area.id} onClick={() => handleAreaSelect(area.id)} className="p-6 rounded-2xl border bg-white hover:border-blue-500 hover:shadow-lg transition-all text-left group">
                              <area.icon size={32} className="text-slate-400 group-hover:text-blue-600 mb-4"/>
                              <h3 className="font-bold text-slate-800">{area.name}</h3>
                              <p className="text-xs text-slate-500 mt-1">{area.desc}</p>
                          </button>
                      ))}
                  </div>
                  {!showAllAreas && (
                      <button onClick={() => setShowAllAreas(true)} className="mt-6 w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">
                          Ver todas as áreas (+16)
                      </button>
                  )}
              </div>
          )}

          {/* --- STEP 2: FATOS --- */}
          {currentStep === 2 && (
              <div className="max-w-3xl mx-auto">
                  <h2 className="text-xl font-bold text-slate-800 mb-4">Detalhamento dos Fatos</h2>
                  
                  {/* Subáreas */}
                  <div className="flex flex-wrap gap-2 mb-6">
                      {availableSubtypes.map(sub => (
                          <button key={sub} onClick={() => setFormData({...formData, species: sub})} className={`px-4 py-2 rounded-full text-xs font-bold border transition ${formData.species === sub ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                              {sub}
                          </button>
                      ))}
                  </div>

                  {/* Caixa de Texto com Sugestão */}
                  <div className="relative">
                      <textarea 
                          value={formData.facts} 
                          onChange={e => setFormData({...formData, facts: e.target.value})}
                          className="w-full h-64 p-5 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-100 text-sm leading-relaxed resize-none"
                          placeholder="Comece descrevendo o ocorrido..."
                      />
                      {formData.facts.length === 0 && (
                          <div className="absolute top-16 left-5 right-5 text-slate-400 text-xs pointer-events-none">
                              <p className="mb-2 font-bold">💡 Sugestão para melhor análise da IA:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                  <li>Cite datas e locais específicos.</li>
                                  <li>Descreva valores monetários envolvidos.</li>
                                  <li>Mencione tentativas anteriores de contato.</li>
                                  <li>Anexe provas abaixo para fortalecer o documento.</li>
                              </ul>
                          </div>
                      )}
                  </div>

                  {/* Evidências */}
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase flex items-center"><UploadCloud size={16} className="mr-2"/> Evidências (Fotos, Vídeos, PDF)</span>
                          <label className="bg-white border border-slate-300 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50">
                              + Adicionar
                              <input type="file" className="hidden" multiple accept="image/*,application/pdf,video/*" onChange={handleFileSelect}/>
                          </label>
                      </div>
                      <div className="flex gap-2 overflow-x-auto">
                          {localFiles.map(f => (
                              <div key={f.id} className="w-24 h-24 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2 relative shrink-0">
                                  {f.type === 'image' ? <img src={f.previewUrl} className="w-full h-12 object-cover rounded mb-1"/> : <FileText size={24} className="mb-1 text-slate-400"/>}
                                  <span className="text-[9px] text-slate-500 truncate w-full text-center">{f.name}</span>
                              </div>
                          ))}
                          {localFiles.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum arquivo selecionado.</span>}
                      </div>
                  </div>

                  <div className="flex justify-end mt-6">
                      <button onClick={() => { if(!formData.species || !formData.facts) return alert("Preencha todos os campos."); setCurrentStep(3); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 flex items-center">
                          Próximo <ArrowRight size={18} className="ml-2"/>
                      </button>
                  </div>
              </div>
          )}

          {/* --- STEP 3: PARTES (LÓGICA ESTRITA) --- */}
          {currentStep === 3 && (
              <div className="max-w-4xl mx-auto">
                  {partiesStep === 'role_selection' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                          <button onClick={() => { setRole('self'); setPartiesStep('forms'); }} className="bg-white p-10 rounded-2xl border hover:border-blue-500 hover:shadow-lg transition group text-left">
                              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6"><User size={32}/></div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">Sou o Notificante (Pessoa Física)</h3>
                              <p className="text-slate-500 text-sm">Estou enviando em meu próprio nome (CPF).</p>
                          </button>
                          <button onClick={() => { setRole('representative'); setPartiesStep('forms'); }} className="bg-white p-10 rounded-2xl border hover:border-purple-500 hover:shadow-lg transition group text-left">
                              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-6"><Briefcase size={32}/></div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">Sou Representante/Advogado</h3>
                              <p className="text-slate-500 text-sm">Estou agindo em nome de um cliente (PF ou Empresa).</p>
                          </button>
                      </div>
                  ) : (
                      <div className="animate-fade-in">
                          <button onClick={() => setPartiesStep('role_selection')} className="mb-6 text-slate-500 hover:text-slate-800 flex items-center text-sm font-bold"><ChevronLeft size={16}/> Voltar para seleção</button>
                          
                          {role === 'representative' && (
                              <PersonForm 
                                title="Seus Dados (Representante)" section="representative" data={formData.representative} colorClass="border-purple-500" 
                                onInputChange={handleInputChange} onAddressChange={handleAddressChange} 
                                documentLabel="Seu CPF" isCompanyAllowed={false}
                              />
                          )}

                          <PersonForm 
                            title={role === 'representative' ? "Dados do Cliente (Notificante)" : "Seus Dados (Notificante)"} 
                            section="sender" data={formData.sender} colorClass="border-blue-500" 
                            onInputChange={handleInputChange} onAddressChange={handleAddressChange} 
                            documentLabel={role === 'representative' ? "CPF ou CNPJ" : "Seu CPF"} 
                            documentMask={role === 'representative' ? MASKS.cpfCnpj : MASKS.cpf}
                            documentMaxLength={role === 'representative' ? 18 : 14}
                            isCompanyAllowed={role === 'representative'} 
                          />

                          <PersonForm 
                            title="Dados do Notificado (Quem recebe)" section="recipient" data={formData.recipient} colorClass="border-red-500" 
                            onInputChange={handleInputChange} onAddressChange={handleAddressChange} 
                            documentLabel="CPF ou CNPJ" documentMask={MASKS.cpfCnpj} documentMaxLength={18} isCompanyAllowed={true}
                          />

                          <div className="flex justify-end">
                              <button onClick={() => setCurrentStep(4)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800">Continuar</button>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* --- STEP 4: CONCILIAÇÃO --- */}
          {currentStep === 4 && (
              <div className="max-w-xl mx-auto text-center">
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
                      <Video size={48} className="text-green-500 mx-auto mb-4"/>
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">Audiência de Conciliação</h2>
                      <p className="text-slate-500 text-sm mb-6">Deseja agendar automaticamente uma reunião via Google Meet para tentar um acordo?</p>
                      
                      <div className="flex justify-center gap-4 mb-6">
                          <button onClick={() => setFormData({...formData, scheduleMeeting: true})} className={`px-6 py-3 rounded-xl font-bold border transition ${formData.scheduleMeeting ? 'bg-green-50 border-green-500 text-green-700' : 'border-slate-200 text-slate-500'}`}>Sim, agendar</button>
                          <button onClick={() => setFormData({...formData, scheduleMeeting: false})} className={`px-6 py-3 rounded-xl font-bold border transition ${!formData.scheduleMeeting ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-500'}`}>Não</button>
                      </div>

                      {formData.scheduleMeeting && (
                          <div className="text-left bg-slate-50 p-4 rounded-xl">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                              <input type="date" value={formData.meetingDate} onChange={e => setFormData({...formData, meetingDate: e.target.value})} className="w-full p-2 bg-white border rounded-lg mb-3"/>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
                              <input type="time" value={formData.meetingTime} onChange={e => setFormData({...formData, meetingTime: e.target.value})} className="w-full p-2 bg-white border rounded-lg"/>
                              <p className="text-[10px] text-green-600 mt-2 flex items-center font-bold"><CheckCircle2 size={10} className="mr-1"/> Link do Meet será gerado e inserido no documento.</p>
                          </div>
                      )}
                  </div>
                  <button onClick={() => setCurrentStep(5)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 w-full">Confirmar e Gerar</button>
              </div>
          )}

          {/* --- STEP 5: GERAÇÃO IA --- */}
          {currentStep === 5 && (
              <div className="max-w-2xl mx-auto text-center py-12">
                  {!isGenerating ? (
                      <>
                          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                              <Sparkles size={48}/>
                          </div>
                          <h2 className="text-3xl font-bold text-slate-800 mb-4">Inteligência Jurídica Pronta</h2>
                          <p className="text-slate-500 mb-8 max-w-md mx-auto">Nosso motor de IA analisou seus fatos, a área {currentArea?.name} e as evidências. Clique abaixo para redigir a minuta final.</p>
                          <button onClick={handleGenerateContent} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:shadow-xl hover:scale-105 transition-all flex items-center mx-auto">
                              <Wand2 size={24} className="mr-2"/> Gerar Notificação
                          </button>
                      </>
                  ) : (
                      <div className="flex flex-col items-center">
                          <Loader2 size={64} className="text-blue-600 animate-spin mb-6"/>
                          <h3 className="text-xl font-bold text-slate-800">Processando estratégia jurídica...</h3>
                          <p className="text-slate-400 text-sm mt-2">Otimizando a narrativa para melhor resultado.</p>
                      </div>
                  )}
              </div>
          )}

          {/* --- STEP 6: REVISÃO E ASSINATURA --- */}
          {currentStep === 6 && (
              <div className="max-w-4xl mx-auto space-y-8">
                  <div className="bg-white shadow-lg border border-slate-200 rounded-none w-full min-h-[800px] p-12 md:p-20 relative mx-auto font-serif text-slate-900">
                      
                      {/* Papel A4 Mockup */}
                      <div className="text-center mb-12">
                          <h2 className="text-xl font-bold uppercase tracking-widest border-b-2 border-slate-900 pb-2 inline-block">Notificação Extrajudicial</h2>
                          <p className="text-xs text-slate-500 mt-2">Documento Oficial | Hash: {docHash}</p>
                      </div>

                      <div className="text-justify text-sm leading-relaxed whitespace-pre-wrap mb-16">
                          {formData.generatedContent}
                      </div>

                      {/* Área de Assinatura */}
                      <div className="mt-12 pt-8 border-t border-slate-100">
                          <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Assinatura do Notificante</h4>
                          
                          {isSigned && signatureData ? (
                              <div className="relative inline-block border-b border-slate-900 pb-2 px-10">
                                  <img src={signatureData} alt="Assinatura" className="h-16 object-contain" />
                                  <p className="text-center text-xs mt-1 font-bold">{formData.sender.name}</p>
                                  <div className="absolute -top-3 -right-3">
                                      <CheckCircle2 size={20} className="text-green-500 bg-white rounded-full"/>
                                  </div>
                              </div>
                          ) : (
                              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative h-48 touch-none cursor-crosshair overflow-hidden w-full max-w-md">
                                  <canvas 
                                      ref={canvasRef}
                                      width={500} height={192}
                                      className="w-full h-full"
                                      onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing}
                                      onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing}
                                  />
                                  {!isDrawing && !signatureData && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 font-bold text-xl opacity-50">ASSINE AQUI</div>}
                              </div>
                          )}
                          
                          <div className="flex gap-4 mt-4">
                              {!isSigned ? (
                                  <>
                                    <button onClick={handleClearSignature} className="text-red-500 text-xs font-bold hover:bg-red-50 px-3 py-1 rounded">Limpar</button>
                                    <button onClick={handleConfirmSignature} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-slate-800">Validar e Anexar Assinatura</button>
                                  </>
                              ) : (
                                  <button onClick={() => { setIsSigned(false); setSignatureData(null); }} className="text-slate-400 text-xs hover:text-slate-600 underline">Refazer assinatura</button>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end p-4 sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-slate-200">
                      <button 
                        onClick={() => { if(!isSigned) return alert("Assine o documento antes de continuar."); setCurrentStep(7); }} 
                        className={`px-8 py-3 rounded-xl font-bold shadow-lg flex items-center transition-all ${isSigned ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      >
                          Ir para Envio <ArrowRight size={18} className="ml-2"/>
                      </button>
                  </div>
              </div>
          )}

          {/* --- STEP 7: SELEÇÃO DE ENVIO (Full Time) --- */}
          {currentStep === 7 && (
              <div className="max-w-3xl mx-auto">
                  <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">Configuração de Envio</h2>
                  
                  <button onClick={handleStartPayment} className="w-full bg-white p-8 rounded-3xl border-2 border-blue-600 shadow-2xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
                      <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider">Recomendado</div>
                      
                      <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                              <Rocket size={32}/>
                          </div>
                          <div className="text-center md:text-left">
                              <h3 className="text-2xl font-bold text-slate-900">Full Time Notificação</h3>
                              <p className="text-slate-500">Envio imediato, certificado e com rastreamento total.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                          <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="bg-green-100 p-2 rounded-full mr-3"><CheckCircle2 size={16} className="text-green-600"/></div>
                              <span className="text-sm font-medium text-slate-700">E-mail Certificado (SendGrid)</span>
                          </div>
                          <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="bg-green-100 p-2 rounded-full mr-3"><CheckCircle2 size={16} className="text-green-600"/></div>
                              <span className="text-sm font-medium text-slate-700">WhatsApp Oficial (Z-API)</span>
                          </div>
                          <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="bg-green-100 p-2 rounded-full mr-3"><CheckCircle2 size={16} className="text-green-600"/></div>
                              <span className="text-sm font-medium text-slate-700">Monitoramento em Tempo Real</span>
                          </div>
                          <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="bg-green-100 p-2 rounded-full mr-3"><CheckCircle2 size={16} className="text-green-600"/></div>
                              <span className="text-sm font-medium text-slate-700">Registro em Blockchain (Hash)</span>
                          </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                          <div>
                              <p className="text-xs text-slate-400 uppercase font-bold">Valor Total</p>
                              <span className="text-3xl font-bold text-slate-800">R$ 57,92</span>
                          </div>
                          <span className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg group-hover:bg-blue-600 transition-colors">
                              Contratar e Enviar Agora
                          </span>
                      </div>
                  </button>
              </div>
          )}

          {/* --- STEP 8: PAGAMENTO PIX --- */}
          {currentStep === 8 && (
              <div className="max-w-md mx-auto text-center bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento Seguro via Pix</h2>
                  <p className="text-slate-500 text-sm mb-6">Escaneie para liberar o envio imediato.</p>
                  
                  {isProcessingPayment && !pixData ? (
                      <div className="py-12 flex flex-col items-center">
                          <Loader2 size={48} className="animate-spin text-blue-600 mb-4"/>
                          <span className="text-slate-400 text-sm">Gerando cobrança segura...</span>
                      </div>
                  ) : pixData ? (
                      <div className="animate-fade-in">
                          <div className="bg-white p-2 border rounded-xl mb-4 inline-block shadow-inner"><img src={`data:image/png;base64,${pixData.encodedImage}`} className="w-48 h-48"/></div>
                          <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between gap-2 mb-4 border border-slate-200">
                              <span className="text-xs font-mono truncate text-slate-500">{pixData.payload}</span>
                              <button onClick={() => {navigator.clipboard.writeText(pixData.payload); alert("Copiado!");}} className="text-blue-600 font-bold text-xs bg-blue-50 p-2 rounded hover:bg-blue-100">COPIAR</button>
                          </div>
                          <div className="flex items-center justify-center text-emerald-600 font-bold text-sm animate-pulse bg-emerald-50 p-3 rounded-xl">
                              <RefreshCw size={16} className="animate-spin mr-2"/> Aguardando confirmação do banco...
                          </div>
                      </div>
                  ) : <p className="text-red-500">Erro ao carregar Pix.</p>}
              </div>
          )}

          {/* --- STEP 9: PROTOCOLO --- */}
          {currentStep === 9 && (
              <div className="text-center py-12 animate-fade-in">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-100">
                      <CheckCircle2 size={48} className="text-green-600"/>
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800 mb-2">Sucesso!</h2>
                  <p className="text-slate-600 mb-8 max-w-md mx-auto">Sua notificação foi paga, enviada para e-mail/WhatsApp e registrada. Acompanhe o status no painel.</p>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 max-w-sm mx-auto mb-8 text-left">
                      <div className="flex justify-between mb-2">
                          <span className="text-xs text-slate-500">Protocolo</span>
                          <span className="text-xs font-mono font-bold">{notificationId}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-xs text-slate-500">Hash</span>
                          <span className="text-xs font-mono text-slate-400 truncate w-32">{docHash}</span>
                      </div>
                  </div>

                  <button onClick={() => onSave(createdData.notif!, createdData.meet, createdData.trans)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition transform hover:-translate-y-1">Voltar ao Painel</button>
              </div>
          )}
      </div>
  );
};

export default NotificationCreator;
