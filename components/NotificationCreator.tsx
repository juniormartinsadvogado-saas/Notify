
import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadSignedPdf, uploadEvidence } from '../services/notificationService';
import { initiateCheckout, checkPaymentStatus, saveTransaction } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { dispatchCommunications } from '../services/communicationService';
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Scale, FileText, Users, Video, Wand2, FileSignature, Rocket, Zap, CheckCircle2, 
  ChevronLeft, ChevronRight, ChevronDown, Upload, Calendar, Clock, MapPin, 
  User, Briefcase, Mail, Phone, Home, Building, Flag, AlertCircle, Smile, 
  ArrowRight, Loader2, Copy, ShieldCheck, Lock, Gavel, Heart, ShoppingBag, 
  Monitor, Plane, Anchor, Leaf, Globe, CreditCard, Eye
} from 'lucide-react';
import { jsPDF } from "jspdf";

// --- CONSTANTES E DADOS ---

const STEPS = [
  { id: 1, label: 'Áreas', icon: Scale },
  { id: 2, label: 'Fatos', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video },
  { id: 5, label: 'Geração', icon: Wand2 },
  { id: 6, label: 'Assinatura', icon: FileSignature },
  { id: 7, label: 'Envio', icon: Rocket },
  { id: 8, label: 'Pagamento', icon: Zap },
  { id: 9, label: 'Protocolo', icon: CheckCircle2 },
];

const ALL_AREAS = [
    { id: 'civil', name: 'Civil', icon: Scale, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'trabalhista', name: 'Trabalhista', icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'consumidor', name: 'Consumidor', icon: ShoppingBag, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'imobiliario', name: 'Imobiliário', icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'contratual', name: 'Contratual', icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' },
    { id: 'familia', name: 'Família', icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
    { id: 'sucessoes', name: 'Sucessões', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'empresarial', name: 'Empresarial', icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'tributario', name: 'Tributário', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { id: 'criminal', name: 'Criminal', icon: Gavel, color: 'text-gray-800', bg: 'bg-gray-100' },
    { id: 'administrativo', name: 'Administrativo', icon: Flag, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { id: 'previdenciario', name: 'Previdenciário', icon: ShieldCheck, color: 'text-green-700', bg: 'bg-green-50' },
    { id: 'ambiental', name: 'Ambiental', icon: Leaf, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'internacional', name: 'Internacional', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-50' },
    { id: 'maritimo', name: 'Marítimo', icon: Anchor, color: 'text-cyan-700', bg: 'bg-cyan-50' },
    { id: 'aeronautico', name: 'Aeronáutico', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-50' },
    { id: 'energetico', name: 'Energético', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { id: 'espacial', name: 'Espacial', icon: Rocket, color: 'text-indigo-900', bg: 'bg-indigo-100' },
    { id: 'digital', name: 'Digital', icon: Monitor, color: 'text-violet-500', bg: 'bg-violet-50' },
    { id: 'esportivo', name: 'Esportivo', icon: ActivityIcon, color: 'text-orange-500', bg: 'bg-orange-50' }
];

// Helper icon fallback
function ActivityIcon(props: any) { return <Zap {...props} /> }

const GET_SUBAREAS = (areaId: string) => {
    // Gera subáreas dinâmicas baseadas no ID para simular as 6 opções
    return [
        `Inadimplência ${areaId}`,
        `Descumprimento Contratual`,
        `Responsabilidade Civil`,
        `Danos Materiais/Morais`,
        `Obrigação de Fazer`,
        `Outros Assuntos ${areaId}`
    ];
};

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
  onBack?: () => void;
}

interface AddressData {
    cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string;
}

interface PersonData {
    name: string; cpfCnpj: string; email: string; phone: string;
    address: AddressData;
}

interface LocalAttachment { id: string; file: File; previewUrl: string; name: string; type: 'image' | 'video' | 'document'; }

const initialAddress: AddressData = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
const initialPerson: PersonData = { name: '', cpfCnpj: '', email: '', phone: '', address: { ...initialAddress } };

// MÁSCARAS
const MASKS = {
    cpfCnpj: (v: string) => v.replace(/\D/g, '').length > 11 
        ? v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18)
        : v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
    phone: (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').substring(0, 15),
    cep: (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9)
};

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user, onBack }) => {
  // Estado Principal
  const [currentStep, setCurrentStep] = useState(1);
  const [notificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  const [docHash] = useState(Array(4).fill(0).map(() => Math.random().toString(36).substr(2, 4).toUpperCase()).join('-'));

  // Step 1: Áreas
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [showAllAreas, setShowAllAreas] = useState(false);

  // Step 2: Fatos
  const [selectedSubArea, setSelectedSubArea] = useState<string>('');
  const [factsText, setFactsText] = useState('');
  const [localFiles, setLocalFiles] = useState<LocalAttachment[]>([]);

  // Step 3: Partes
  const [roleMode, setRoleMode] = useState<'self' | 'representative' | null>(null); // self = Eu sou o remetente
  const [sender, setSender] = useState<PersonData>({ ...initialPerson, name: user?.displayName || '', email: user?.email || '' });
  const [recipient, setRecipient] = useState<PersonData>({ ...initialPerson });
  const [representative, setRepresentative] = useState<PersonData>({ ...initialPerson });

  // Step 4: Conciliação
  const [scheduleMeeting, setScheduleMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  // Step 5: Geração
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');

  // Step 6: Assinatura
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Step 8: Pagamento
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Scroll to top on step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [currentStep]);

  // Polling de Pagamento
  useEffect(() => {
      let interval: any;
      if (currentStep === 8 && asaasPaymentId && !isFinalizing) {
          interval = setInterval(async () => {
              const status = await checkPaymentStatus(asaasPaymentId);
              if (status.paid) {
                  clearInterval(interval);
                  await handlePaymentSuccessAndSave();
              }
          }, 3000);
      }
      return () => clearInterval(interval);
  }, [currentStep, asaasPaymentId, isFinalizing]);

  // --- LÓGICA DE SALVAMENTO (CORE) ---
  const handlePaymentSuccessAndSave = async () => {
      setIsFinalizing(true);
      try {
          // 1. Upload Evidências
          const evidences: EvidenceItem[] = [];
          if (localFiles.length > 0) {
              const uploads = await Promise.all(localFiles.map(f => uploadEvidence(notificationId, f.file).catch(()=>null)));
              uploads.forEach(u => u && evidences.push(u));
          }

          // 2. Gerar PDF Final
          const pdfUrl = await generateAndUploadPdf();

          // 3. Montar Objetos
          const finalNotification: NotificationItem = {
              id: notificationId,
              documentHash: docHash,
              notificante_uid: user.uid,
              notificante_cpf: sender.cpfCnpj.replace(/\D/g, ''),
              notificados_cpfs: [recipient.cpfCnpj.replace(/\D/g, '')],
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              recipientPhone: recipient.phone,
              recipientDocument: recipient.cpfCnpj,
              recipientAddress: formatAddress(recipient.address),
              notificante_dados_expostos: { nome: sender.name, email: sender.email, telefone: sender.phone },
              area: selectedArea,
              species: selectedSubArea,
              facts: factsText,
              subject: `Notificação Extrajudicial - ${selectedSubArea}`,
              content: generatedContent,
              evidences,
              pdf_url: pdfUrl,
              signatureBase64: signatureData || undefined,
              createdAt: new Date().toISOString(),
              status: NotificationStatus.SENT,
              paymentAmount: 57.92,
              paymentId: asaasPaymentId || undefined,
              paymentMethod: 'PIX'
          };

          // 4. Salvar Tudo
          await saveNotification(finalNotification);
          
          await saveTransaction(user.uid, {
              id: asaasPaymentId || `TX-${Date.now()}`,
              description: `Notificação ${selectedSubArea}`,
              amount: 57.92,
              date: new Date().toISOString(),
              status: 'Pago',
              notificationId: notificationId,
              recipientName: recipient.name,
              userId: user.uid
          });

          if (scheduleMeeting) {
              await createMeeting({
                  id: `MEET-${Date.now()}`, hostUid: user.uid, hostName: user.displayName,
                  title: `Conciliação: ${selectedSubArea}`, date: meetingDate, time: meetingTime,
                  guestEmail: recipient.email, guestCpf: recipient.cpfCnpj.replace(/\D/g,''),
                  meetLink: "https://meet.google.com/yjg-zhrg-rez", createdAt: new Date().toISOString(), status: 'scheduled'
              });
          }

          // 5. Disparar Comunicações
          await dispatchCommunications(finalNotification);

          setCurrentStep(9); // Protocolo

      } catch (e: any) {
          alert("Erro crítico ao salvar: " + e.message);
      } finally {
          setIsFinalizing(false);
      }
  };

  const generateAndUploadPdf = async (): Promise<string> => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const width = doc.internal.pageSize.getWidth();
      
      // Marca D'água
      doc.setTextColor(245, 245, 245);
      doc.setFontSize(60);
      doc.text("NOTIFY ORIGINAL", width/2, 150, { align: 'center', angle: 45 });

      // Conteúdo
      doc.setTextColor(0,0,0);
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("NOTIFICAÇÃO EXTRAJUDICIAL", width/2, 20, { align: "center" });
      
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      
      const lines = doc.splitTextToSize(generatedContent, width - 40);
      let y = 40;
      lines.forEach((line: string) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, 20, y);
          y += 5;
      });

      // Assinatura
      if (signatureData) {
          if (y > 240) doc.addPage();
          doc.addImage(signatureData, 'PNG', width/2 - 25, y + 10, 50, 20);
          y += 35;
          doc.setFontSize(10);
          doc.text(sender.name.toUpperCase(), width/2, y, { align: "center" });
          doc.text(`CPF: ${sender.cpfCnpj}`, width/2, y + 5, { align: "center" });
          
          // Carimbo
          doc.setDrawColor(0, 0, 150);
          doc.rect(width - 60, y - 20, 40, 20);
          doc.setTextColor(0, 0, 150);
          doc.setFontSize(7);
          doc.text("ASSINADO DIGITALMENTE", width - 40, y - 15, { align: "center" });
          doc.text(new Date().toLocaleString(), width - 40, y - 10, { align: "center" });
          doc.text(docHash.substring(0, 15), width - 40, y - 5, { align: "center" });
      }

      return await uploadSignedPdf(notificationId, doc.output('blob'), docHash);
  };

  const formatAddress = (addr: AddressData) => `${addr.street}, ${addr.number} ${addr.complement ? '- ' + addr.complement : ''}, ${addr.neighborhood}, ${addr.city}/${addr.state} - CEP: ${addr.cep}`;

  // --- RENDERIZADORES DE COMPONENTES ---

  const StepIndicator = () => (
      <div className="mb-8 overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex items-center min-w-max px-4">
              {STEPS.map((step, idx) => (
                  <div key={step.id} className="flex items-center">
                      <div className={`flex flex-col items-center gap-1 group ${currentStep === step.id ? 'opacity-100' : currentStep > step.id ? 'opacity-70' : 'opacity-40'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                              currentStep === step.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 
                              currentStep > step.id ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>
                              {currentStep > step.id ? <CheckCircle2 size={20}/> : <step.icon size={18}/>}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider">{step.label}</span>
                      </div>
                      {idx < STEPS.length - 1 && (
                          <div className={`w-12 h-0.5 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                      )}
                  </div>
              ))}
          </div>
      </div>
  );

  const AddressForm = ({ data, onChange, prefix }: { data: AddressData, onChange: (field: keyof AddressData, val: string) => void, prefix: string }) => (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">CEP</label>
              <input value={data.cep} onChange={e => onChange('cep', MASKS.cep(e.target.value))} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="00000-000" />
          </div>
          <div className="col-span-1 md:col-span-3">
              <label className="text-[10px] font-bold uppercase text-slate-400">Rua / Avenida</label>
              <input value={data.street} onChange={e => onChange('street', e.target.value)} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="Nome do Logradouro" />
          </div>
          <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Número</label>
              <input value={data.number} onChange={e => onChange('number', e.target.value)} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="123" />
          </div>
          <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Comp.</label>
              <input value={data.complement} onChange={e => onChange('complement', e.target.value)} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="Apto 101" />
          </div>
          <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Bairro</label>
              <input value={data.neighborhood} onChange={e => onChange('neighborhood', e.target.value)} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="Centro" />
          </div>
          <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Cidade</label>
              <input value={data.city} onChange={e => onChange('city', e.target.value)} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="São Paulo" />
          </div>
          <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">UF</label>
              <input value={data.state} maxLength={2} onChange={e => onChange('state', e.target.value.toUpperCase())} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="SP" />
          </div>
      </div>
  );

  const PersonFormBlock = ({ title, icon: Icon, color, data, setData, type }: { title: string, icon: any, color: string, data: PersonData, setData: React.Dispatch<React.SetStateAction<PersonData>>, type: 'PF' | 'PJ' | 'BOTH' }) => (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className={`absolute top-0 left-0 w-1 h-full ${color}`}></div>
          <div className="flex items-center gap-2 mb-6">
              <div className={`p-2 rounded-lg ${color.replace('bg-', 'bg-opacity-10 text-')}`}><Icon size={20}/></div>
              <h3 className="font-bold text-slate-800">{title}</h3>
          </div>
          
          <div className="space-y-4">
              <div className="relative group/input">
                  <User size={16} className="absolute left-3 top-3.5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors"/>
                  <input value={data.name} onChange={e => setData(p => ({...p, name: e.target.value}))} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm" placeholder={type === 'PJ' ? "Razão Social" : "Nome Completo"} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group/input">
                      <CreditCard size={16} className="absolute left-3 top-3.5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors"/>
                      <input value={data.cpfCnpj} maxLength={18} onChange={e => setData(p => ({...p, cpfCnpj: MASKS.cpfCnpj(e.target.value)}))} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm" placeholder={type === 'PJ' ? "CNPJ" : "CPF"} />
                  </div>
                  <div className="relative group/input">
                      <span className="absolute left-3 top-3.5 text-slate-400 font-bold text-xs pointer-events-none group-focus-within/input:text-green-600">+55</span>
                      <input value={data.phone} maxLength={15} onChange={e => setData(p => ({...p, phone: MASKS.phone(e.target.value)}))} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm" placeholder="WhatsApp" />
                  </div>
              </div>

              <div className="relative group/input">
                  <Mail size={16} className="absolute left-3 top-3.5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors"/>
                  <input value={data.email} type="email" onChange={e => setData(p => ({...p, email: e.target.value}))} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm" placeholder="E-mail" />
              </div>

              <AddressDataForm data={data.address} onChange={(f, v) => setData(p => ({...p, address: {...p.address, [f]: v}}))} />
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none transform rotate-12">
              <Icon size={150} />
          </div>
      </div>
  );

  const AddressDataForm = ({ data, onChange }: { data: AddressData, onChange: (f: keyof AddressData, v: string) => void }) => (
      <div className="pt-2">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center"><MapPin size={12} className="mr-1"/> Endereço</p>
          <AddressForm data={data} onChange={onChange} prefix="" />
      </div>
  );

  // --- RENDER STEP CONTENT ---

  const renderStepContent = () => {
      switch(currentStep) {
          case 1: // ÁREAS
              const areasToShow = showAllAreas ? ALL_AREAS : ALL_AREAS.slice(0, 4);
              return (
                  <div className="animate-fade-in">
                      <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">Qual a Área do Direito?</h2>
                      <p className="text-slate-500 text-center mb-8">Selecione para calibrar a IA Jurídica.</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          {areasToShow.map(area => (
                              <button key={area.id} onClick={() => { setSelectedArea(area.name); setCurrentStep(2); }} className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 group hover:shadow-xl hover:-translate-y-1 ${area.bg} border-transparent hover:border-blue-200`}>
                                  <area.icon size={32} className={`${area.color} group-hover:scale-110 transition-transform`} />
                                  <span className="font-bold text-slate-700 text-sm">{area.name}</span>
                              </button>
                          ))}
                      </div>
                      {!showAllAreas && (
                          <div className="text-center">
                              <button onClick={() => setShowAllAreas(true)} className="text-blue-600 font-bold text-sm hover:underline flex items-center justify-center mx-auto">
                                  Ver todas as 20 áreas <ChevronDown size={16} className="ml-1"/>
                              </button>
                          </div>
                      )}
                  </div>
              );

          case 2: // FATOS
              return (
                  <div className="animate-fade-in max-w-4xl mx-auto">
                      <h2 className="text-2xl font-bold text-slate-800 mb-6">Especifique o Caso</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                          {GET_SUBAREAS(selectedArea).map(sub => (
                              <button key={sub} onClick={() => setSelectedSubArea(sub)} className={`p-3 rounded-xl border text-sm font-medium transition-all ${selectedSubArea === sub ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                  {sub}
                              </button>
                          ))}
                      </div>
                      {selectedSubArea && (
                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-slide-in-up">
                              <label className="text-sm font-bold text-slate-700 mb-2 block">Relate os fatos ocorridos:</label>
                              <textarea value={factsText} onChange={e => setFactsText(e.target.value)} className="w-full h-40 p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none mb-4" placeholder="Ex: No dia 15/05, contratei os serviços... O prazo de entrega era... Tentei contato via..."/>
                              
                              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition cursor-pointer relative">
                                  <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                      if(e.target.files) Array.from(e.target.files).forEach((f: File) => setLocalFiles(p => [...p, { id: Math.random().toString(), file: f, name: f.name, previewUrl: URL.createObjectURL(f), type: f.type.startsWith('image') ? 'image' : 'document' }]));
                                  }}/>
                                  <Upload size={24} className="mb-2 text-blue-500"/>
                                  <span className="text-xs font-bold">Anexar Evidências (Fotos, PDF, Prints)</span>
                              </div>
                              {localFiles.length > 0 && <div className="flex gap-2 mt-4 flex-wrap">{localFiles.map(f => <span key={f.id} className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200 flex items-center">{f.name}</span>)}</div>}
                              
                              <div className="mt-6 flex justify-end">
                                  <button onClick={() => { if(!factsText) return alert('Descreva os fatos'); setCurrentStep(3); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition">Avançar</button>
                              </div>
                          </div>
                      )}
                  </div>
              );

          case 3: // PARTES
              return (
                  <div className="animate-fade-in max-w-5xl mx-auto">
                      {!roleMode ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-12">
                              <button onClick={() => setRoleMode('self')} className="bg-white p-10 rounded-3xl border-2 border-slate-100 hover:border-blue-500 hover:shadow-2xl transition group text-center relative overflow-hidden">
                                  <User size={64} className="mx-auto mb-6 text-slate-300 group-hover:text-blue-600 transition-colors"/>
                                  <h3 className="text-xl font-bold text-slate-800">Sou o Remetente</h3>
                                  <p className="text-sm text-slate-500 mt-2">Eu mesmo estou enviando a notificação.</p>
                              </button>
                              <button onClick={() => setRoleMode('representative')} className="bg-white p-10 rounded-3xl border-2 border-slate-100 hover:border-purple-500 hover:shadow-2xl transition group text-center relative overflow-hidden">
                                  <Briefcase size={64} className="mx-auto mb-6 text-slate-300 group-hover:text-purple-600 transition-colors"/>
                                  <h3 className="text-xl font-bold text-slate-800">Sou Representante</h3>
                                  <p className="text-sm text-slate-500 mt-2">Advogado ou procurador da parte.</p>
                              </button>
                          </div>
                      ) : (
                          <div className="space-y-6">
                              <div className="flex items-center justify-between mb-4">
                                  <button onClick={() => setRoleMode(null)} className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center"><ChevronLeft size={16}/> Voltar seleção</button>
                                  <h2 className="text-xl font-bold text-slate-800">Identificação das Partes</h2>
                              </div>
                              
                              {roleMode === 'representative' && (
                                  <PersonFormBlock title="Representante (Você)" icon={Briefcase} color="bg-purple-500" data={representative} setData={setRepresentative} type="PF" />
                              )}
                              <PersonFormBlock title="Remetente (Quem notifica)" icon={User} color="bg-blue-500" data={sender} setData={setSender} type="BOTH" />
                              <PersonFormBlock title="Destinatário (Quem recebe)" icon={AlertCircle} color="bg-red-500" data={recipient} setData={setRecipient} type="BOTH" />

                              <div className="flex justify-end pt-4">
                                  <button onClick={() => { 
                                      if(!sender.name || !recipient.name) return alert("Preencha os nomes.");
                                      setCurrentStep(4);
                                  }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition">Continuar</button>
                              </div>
                          </div>
                      )}
                  </div>
              );

          case 4: // CONCILIAÇÃO
              return (
                  <div className="max-w-2xl mx-auto text-center py-10 animate-fade-in">
                      <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <HandshakeIcon size={48} className="text-teal-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">Propor Conciliação?</h2>
                      <p className="text-slate-500 mb-8 px-10">Agende uma reunião virtual automática para tentar um acordo amigável.</p>
                      
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left mb-8">
                          <div className="flex items-center justify-between mb-4">
                              <span className="font-bold text-slate-700">Agendar Reunião</span>
                              <div onClick={() => setScheduleMeeting(!scheduleMeeting)} className={`w-12 h-6 rounded-full cursor-pointer transition-colors relative ${scheduleMeeting ? 'bg-teal-500' : 'bg-slate-200'}`}>
                                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${scheduleMeeting ? 'left-7' : 'left-1'}`}></div>
                              </div>
                          </div>
                          
                          {scheduleMeeting && (
                              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Data (Seg-Sex)</label>
                                      <input type="date" min={new Date().toISOString().split('T')[0]} onChange={e => {
                                          const d = new Date(e.target.value);
                                          if(d.getDay() === 0 || d.getDay() === 6) alert("Selecione um dia útil");
                                          else setMeetingDate(e.target.value);
                                      }} className="w-full p-2 bg-slate-50 border rounded-lg"/>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Horário (08-16h)</label>
                                      <select onChange={e => setMeetingTime(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg">
                                          <option value="">Selecione</option>
                                          {['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00'].map(t => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                  </div>
                              </div>
                          )}
                      </div>
                      <button onClick={() => setCurrentStep(5)} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-bold shadow-lg">Confirmar</button>
                  </div>
              );

          case 5: // GERAÇÃO
              return (
                  <div className="max-w-2xl mx-auto text-center py-20 animate-fade-in">
                      {!isGenerating ? (
                          <>
                              <div className="w-32 h-32 mx-auto mb-8 relative">
                                  <div className="absolute inset-0 bg-purple-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                                  <Wand2 size={80} className="text-purple-600 relative z-10 mx-auto mt-6"/>
                              </div>
                              <h2 className="text-3xl font-bold text-slate-900 mb-4">Inteligência Artificial</h2>
                              <p className="text-slate-500 mb-8">Nossa IA analisará fatos, leis e evidências para redigir um documento jurídico perfeito.</p>
                              <button onClick={async () => {
                                  setIsGenerating(true);
                                  try {
                                      const attachments = localFiles.map(f => ({ file: f.file, preview: f.previewUrl, type: f.type }));
                                      const text = await generateNotificationText(
                                          recipient.name, 
                                          selectedSubArea, 
                                          `REMETENTE: ${sender.name} (CPF: ${sender.cpfCnpj})\nDESTINATÁRIO: ${recipient.name}\nFATOS: ${factsText}\n${scheduleMeeting ? `CONCILIAÇÃO: Dia ${meetingDate} às ${meetingTime}` : ''}`,
                                          'Formal',
                                          attachments,
                                          { area: selectedArea, species: selectedSubArea, areaDescription: 'Jurídica' }
                                      );
                                      setGeneratedContent(text);
                                      setCurrentStep(6);
                                  } catch (e: any) { alert(e.message); } finally { setIsGenerating(false); }
                              }} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all">
                                  Gerar Documento
                              </button>
                          </>
                      ) : (
                          <div className="flex flex-col items-center">
                              <Loader2 size={64} className="animate-spin text-purple-600 mb-6"/>
                              <p className="text-slate-800 font-bold text-xl animate-pulse">Analisando Jurisprudência...</p>
                              <p className="text-slate-400 mt-2">Redigindo cláusulas e fundamentação legal.</p>
                          </div>
                      )}
                  </div>
              );

          case 6: // ASSINATURA
              return (
                  <div className="max-w-4xl mx-auto animate-fade-in">
                      <div className="bg-white shadow-2xl border border-slate-100 p-12 min-h-[600px] mb-8 font-serif text-justify whitespace-pre-wrap leading-relaxed text-slate-800 rounded-sm relative">
                          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-900 via-slate-800 to-blue-900"></div>
                          {generatedContent}
                          <div className="mt-16 pt-8 border-t border-slate-300 text-center">
                              {signatureData ? (
                                  <div className="relative inline-block px-10 py-4 border-2 border-blue-600 rounded-lg group cursor-pointer" onClick={() => setSignatureData(null)}>
                                      <img src={signatureData} className="h-12 mx-auto filter brightness-0"/>
                                      <div className="absolute -right-2 -bottom-2 bg-blue-600 text-white p-1 rounded-full"><CheckCircle2 size={12}/></div>
                                      <p className="text-[10px] text-blue-600 mt-1 font-sans font-bold">Clique para refazer</p>
                                  </div>
                              ) : (
                                  <div className="border-2 dashed border-slate-300 h-40 bg-slate-50 rounded-xl relative cursor-crosshair hover:border-blue-400 transition-colors">
                                      <span className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none text-sm font-sans font-bold">Assine aqui (Mouse ou Dedo)</span>
                                      <canvas 
                                          ref={canvasRef} width={600} height={160} className="w-full h-full"
                                          onMouseDown={(e)=>{const ctx=canvasRef.current?.getContext('2d'); if(!ctx)return; setIsDrawing(true); const r=canvasRef.current!.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(e.clientX-r.left, e.clientY-r.top); ctx.lineWidth=2;}}
                                          onMouseMove={(e)=>{if(!isDrawing)return; const ctx=canvasRef.current?.getContext('2d'); const r=canvasRef.current!.getBoundingClientRect(); ctx?.lineTo(e.clientX-r.left, e.clientY-r.top); ctx?.stroke();}}
                                          onMouseUp={()=>{setIsDrawing(false); setSignatureData(canvasRef.current?.toDataURL() || null);}}
                                      />
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className="flex justify-end">
                          <button onClick={() => { if(!signatureData) return alert("Assine o documento."); setCurrentStep(7); }} className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold shadow-lg">Confirmar e Avançar</button>
                      </div>
                  </div>
              );

          case 7: // ENVIO (VENDAS)
              return (
                  <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center animate-fade-in py-10">
                      <div>
                          <h2 className="text-4xl font-bold text-slate-900 mb-6">Envio Certificado</h2>
                          <div className="space-y-6">
                              <BenefitItem icon={ShieldCheck} title="Validade Jurídica" desc="Documento assinado digitalmente com hash único e carimbo de tempo." color="text-green-600" bg="bg-green-100"/>
                              <BenefitItem icon={Eye} title="Rastreamento Total" desc="Saiba exatamente quando o destinatário recebeu, abriu e clicou." color="text-blue-600" bg="bg-blue-100"/>
                              <BenefitItem icon={Rocket} title="Envio Multicanal" desc="Disparo simultâneo via E-mail Registrado e WhatsApp Oficial." color="text-purple-600" bg="bg-purple-100"/>
                          </div>
                      </div>
                      <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center relative overflow-hidden">
                          <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-xl">OFERTA</div>
                          <div className="mb-6"><span className="text-5xl font-bold text-slate-900">R$ 57,92</span><span className="text-slate-500 block mt-2">Taxa única de processamento</span></div>
                          <button onClick={async () => {
                              try {
                                  const res = await initiateCheckout({ id: notificationId } as any, 'single', 'PIX', null, { name: sender.name, cpfCnpj: sender.cpfCnpj });
                                  if (res.success && res.pixData) { setPixData(res.pixData); setAsaasPaymentId(res.paymentId || null); setCurrentStep(8); }
                                  else alert("Erro ao gerar Pix.");
                              } catch(e:any) { alert(e.message); }
                          }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2">
                              <Zap size={20} className="text-yellow-400"/> CONTRATAR E PAGAR
                          </button>
                          <p className="text-xs text-slate-400 mt-4 flex items-center justify-center"><Lock size={10} className="mr-1"/> Pagamento seguro via Pix</p>
                      </div>
                  </div>
              );

          case 8: // PAGAMENTO
              return (
                  <div className="max-w-md mx-auto text-center py-12 animate-fade-in">
                      <h2 className="text-2xl font-bold text-slate-800 mb-6">Pagamento Seguro</h2>
                      {pixData ? (
                          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 relative">
                              {isFinalizing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10"><Loader2 size={48} className="animate-spin text-blue-600 mb-4"/><p className="font-bold text-slate-800">Confirmando e Salvando...</p></div>}
                              <img src={`data:image/png;base64,${pixData.encodedImage}`} className="w-64 h-64 mx-auto mix-blend-multiply mb-6"/>
                              <div className="flex gap-2 mb-6">
                                  <input readOnly value={pixData.payload} className="w-full text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-500 font-mono"/>
                                  <button onClick={() => {navigator.clipboard.writeText(pixData.payload); alert("Copiado!");}} className="bg-blue-100 text-blue-600 px-4 rounded-lg hover:bg-blue-200"><Copy size={18}/></button>
                              </div>
                              <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 animate-pulse">
                                  <Loader2 size={16} className="animate-spin"/> Aguardando confirmação automática...
                              </div>
                              <p className="text-xs text-slate-400 mt-4 px-4 leading-relaxed">Não feche esta tela. Assim que o pagamento for detectado, sua notificação será salva e enviada automaticamente.</p>
                          </div>
                      ) : <Loader2 className="animate-spin mx-auto"/>}
                  </div>
              );

          case 9: // PROTOCOLO
              return (
                  <div className="max-w-lg mx-auto text-center py-20 animate-fade-in">
                      <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
                          <CheckCircle2 size={48}/>
                      </div>
                      <h2 className="text-3xl font-bold text-slate-800 mb-2">Sucesso!</h2>
                      <p className="text-slate-500 mb-8">Notificação registrada, salva e enviada.</p>
                      <div className="bg-slate-50 p-6 rounded-2xl mb-8 text-left border border-slate-200 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                          <div className="flex justify-between mb-2">
                              <span className="text-xs font-bold text-slate-500 uppercase">Protocolo</span>
                              <span className="text-xs font-mono text-slate-800 font-bold">{notificationId}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">ENVIADA</span>
                          </div>
                      </div>
                      <button onClick={onBack} className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold shadow-xl hover:scale-105 transition">Ir para o Painel</button>
                  </div>
              );
          default: return null;
      }
  };

  const BenefitItem = ({icon: Icon, title, desc, color, bg}: any) => (
      <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${bg} ${color}`}><Icon size={24}/></div>
          <div><h4 className="font-bold text-slate-800">{title}</h4><p className="text-sm text-slate-500 leading-relaxed">{desc}</p></div>
      </div>
  );

  // Helper component icon
  function HandshakeIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m11 14 1.45-2.9a2 2 0 0 1 2.66-.96l1 1"/><path d="m5.67 19 3.55-7.1a2 2 0 0 1 2.85-1.04l.43.25"/><path d="M6 22a2 2 0 0 1-2-2 1 1 0 0 1 1-1h2a2 2 0 0 1 2 2v1"/><path d="M18 22a2 2 0 0 0 2-2 1 1 0 0 0-1-1h-2a2 2 0 0 0-2 2v1"/><path d="M4 18h11a2 2 0 0 1 2 2v1"/><path d="m17 18 1.45-2.9a2 2 0 0 0-.96-2.66l-1-1"/><path d="m18.33 19-3.55-7.1a2 2 0 0 0-2.85-1.04l-.43.25"/></svg> }

  return (
      <div className="max-w-6xl mx-auto pb-24 font-sans text-slate-800">
          <div className="flex items-center justify-between mb-8 px-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition"><ChevronLeft size={24}/></button>
              <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nova Notificação</p>
                  <p className="text-sm font-bold text-slate-800">Etapa {currentStep} de 9</p>
              </div>
          </div>
          <StepIndicator />
          <div className="min-h-[500px]">{renderStepContent()}</div>
      </div>
  );
};

export default NotificationCreator;
