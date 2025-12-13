
import React, { useState, useRef, useEffect } from 'react';
import { generateNotificationText } from '../services/geminiService';
import { saveNotification, uploadSignedPdf } from '../services/notificationService';
import { initiateCheckout, checkPaymentStatus, saveTransaction } from '../services/paymentService';
import { createMeeting } from '../services/meetingService';
import { dispatchCommunications } from '../services/communicationService';
import { NotificationItem, NotificationStatus, EvidenceItem, Meeting, Transaction, Attachment } from '../types';
import { 
  Wand2, Scale, Users, FileText, Check, Loader2, 
  Briefcase, ShoppingBag, Home, Heart, FileSignature, Scroll, 
  User, Video, CheckCircle2, ChevronLeft, Sparkles,
  Gavel, Building2, Landmark, GraduationCap, Leaf, Anchor, 
  Zap, Rocket, Monitor, Trophy, Globe, Plane, ShieldCheck, Mail, Smartphone, IdCard, Smile, Copy, Fingerprint, Lock, Eye, AlertCircle, ArrowRight
} from 'lucide-react';
import { jsPDF } from "jspdf";
import { uploadEvidence } from '../services/notificationService';

// --- CONSTANTES ---
const STEPS = [
  { id: 1, label: 'Área', icon: Scale },
  { id: 2, label: 'Fatos', icon: FileText },
  { id: 3, label: 'Partes', icon: Users },
  { id: 4, label: 'Conciliação', icon: Video },
  { id: 5, label: 'Inteligência', icon: Wand2 },
  { id: 6, label: 'Assinatura', icon: FileSignature },
  { id: 7, label: 'Envio', icon: Rocket }, 
  { id: 8, label: 'Pagamento', icon: Zap },
  { id: 9, label: 'Protocolo', icon: CheckCircle2 },
];

const LAW_AREAS = [
  { id: 'civil', name: 'Civil', icon: Scale, desc: 'Contratos e obrigações.' },
  { id: 'trabalhista', name: 'Trabalhista', icon: Briefcase, desc: 'Relações de trabalho.' },
  { id: 'consumidor', name: 'Consumidor', icon: ShoppingBag, desc: 'Defesa do consumidor.' },
  { id: 'imobiliario', name: 'Imobiliário', icon: Home, desc: 'Aluguel e imóveis.' },
  { id: 'familia', name: 'Família', icon: Heart, desc: 'Divórcios e pensão.' },
  { id: 'empresarial', name: 'Empresarial', icon: Building2, desc: 'Societário e negócios.' },
  { id: 'criminal', name: 'Criminal', icon: Gavel, desc: 'Delitos e infrações.' },
  { id: 'digital', name: 'Digital', icon: Monitor, desc: 'Internet e dados.' },
];

const SUGGESTIONS = [
    "Atraso no pagamento de aluguel",
    "Entrega de produto com defeito",
    "Cobrança indevida de serviço",
    "Descumprimento de contrato",
    "Solicitação de documentos",
    "Notificação de vizinhança (barulho)"
];

interface NotificationCreatorProps {
  onSave: (notification: NotificationItem, meeting?: Meeting, transaction?: Transaction) => void;
  user?: any;
  onBack?: () => void;
}

interface Address { cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; }
interface LocalAttachment { id: string; file: File; previewUrl: string; name: string; type: 'image' | 'video' | 'document'; }

const initialAddress: Address = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };

const MASKS = {
    cpf: (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
    phone: (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2'),
    cep: (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2')
};

const formatAddressString = (addr: Address) => `${addr.street}, ${addr.number}${addr.complement ? ' - ' + addr.complement : ''}, ${addr.neighborhood}, ${addr.city}/${addr.state}, CEP: ${addr.cep}`;

// --- COMPONENTE PARTES (ATUALIZADO COM +55) ---
const PersonForm: React.FC<any> = ({ title, data, section, colorClass, onInputChange, onAddressChange, documentLabel = "CPF", nameLabel = "Nome Completo / Razão Social", documentMask = MASKS.cpf, documentMaxLength = 14, isCompanyAllowed = false }) => (
    <div className={`bg-white p-6 rounded-2xl border-l-4 ${colorClass} shadow-sm border border-slate-200 mb-6`}>
         <h3 className="font-bold text-slate-800 mb-6 flex items-center text-lg">{title}</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Smile size={14} className="text-blue-500"/> {nameLabel}</label>
                <input type="text" value={data.name} onChange={e => onInputChange(section, 'name', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="Nome completo" />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><IdCard size={14} className="text-purple-500"/> {documentLabel}</label>
                <input type="text" value={data.cpfCnpj} maxLength={documentMaxLength} onChange={e => onInputChange(section, 'cpfCnpj', documentMask(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="000.000.000-00" />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Mail size={14} className="text-orange-500"/> Email</label>
                <input type="email" value={data.email} onChange={e => onInputChange(section, 'email', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" placeholder="email@exemplo.com" />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Smartphone size={14} className="text-green-500"/> WhatsApp</label>
                <div className="relative">
                    <span className="absolute left-3 top-3.5 text-slate-400 font-bold text-sm pointer-events-none">+55</span>
                    <input 
                        type="text" 
                        value={data.phone} 
                        maxLength={15} 
                        onChange={e => onInputChange(section, 'phone', MASKS.phone(e.target.value))} 
                        className="w-full pl-11 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 transition" 
                        placeholder="(00) 00000-0000" 
                    />
                </div>
             </div>
         </div>
         <div className="mt-4 pt-4 border-t border-slate-100">
             <span className="text-xs font-bold text-slate-400 uppercase block mb-3 flex items-center gap-1"><Home size={14} className="text-red-500"/> Endereço / Localização</span>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input type="text" placeholder="CEP" value={data.address.cep} onChange={e => onAddressChange(section, 'cep', MASKS.cep(e.target.value))} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Rua / Logradouro" value={data.address.street} onChange={e => onAddressChange(section, 'street', e.target.value)} className="col-span-1 md:col-span-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Número" value={data.address.number} onChange={e => onAddressChange(section, 'number', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Complemento" value={data.address.complement} onChange={e => onAddressChange(section, 'complement', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Bairro" value={data.address.neighborhood} onChange={e => onAddressChange(section, 'neighborhood', e.target.value)} className="col-span-1 md:col-span-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="Cidade" value={data.address.city} onChange={e => onAddressChange(section, 'city', e.target.value)} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                <input type="text" placeholder="UF" value={data.address.state} maxLength={2} onChange={e => onAddressChange(section, 'state', e.target.value.toUpperCase())} className="col-span-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
             </div>
         </div>
    </div>
);

const NotificationCreator: React.FC<NotificationCreatorProps> = ({ onSave, user, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [notificationId] = useState(`NOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
  const [docHash] = useState(Array(4).fill(0).map(() => Math.random().toString(36).substr(2, 4).toUpperCase()).join('-'));
  
  const [role, setRole] = useState<'self' | 'representative' | null>(null);
  const [partiesStep, setPartiesStep] = useState<'role_selection' | 'forms'>('role_selection');

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
  const [isSigned, setIsSigned] = useState(false);
  
  // Payment & Finalization States
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false); // Estado para o "Salvando no DB..."
  const [pixData, setPixData] = useState<{ encodedImage: string, payload: string } | null>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const currentArea = LAW_AREAS.find(a => a.id === formData.areaId);

  // Auto Scroll Stepper
  useEffect(() => {
      if (stepperRef.current) {
          const activeStepElement = stepperRef.current.children[currentStep - 1] as HTMLElement;
          if (activeStepElement) activeStepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
  }, [currentStep]);

  // POLLING DE PAGAMENTO - MANTENDO DADOS EM MEMÓRIA
  useEffect(() => {
      let interval: any;
      if (currentStep === 8 && asaasPaymentId && !isFinalizing) {
          console.log("[PAYMENT] Polling Asaas ID:", asaasPaymentId);
          interval = setInterval(async () => {
              try {
                  const status = await checkPaymentStatus(asaasPaymentId);
                  if (status.paid) {
                      clearInterval(interval);
                      await handlePaymentSuccessAndSave();
                  }
              } catch (e) { console.warn("Polling...", e); }
          }, 3000); 
      }
      return () => clearInterval(interval);
  }, [currentStep, asaasPaymentId, isFinalizing]);

  // --- FUNÇÃO CORE: SALVAR TUDO SOMENTE APÓS O PAGAMENTO ---
  const handlePaymentSuccessAndSave = async () => {
      setIsFinalizing(true);
      try {
          console.log("Pagamento Confirmado! Iniciando persistência...");

          // 1. Upload das Evidências (Storage)
          const uploadedEvidences: EvidenceItem[] = [];
          if (localFiles.length > 0) {
              const promises = localFiles.map(f => uploadEvidence(notificationId, f.file).catch(()=>null));
              const res = await Promise.all(promises);
              res.forEach(r => { if(r) uploadedEvidences.push(r); });
          }

          // 2. Gerar PDF Final com Hash (Memória -> Storage)
          const pdfUrl = await generateAndUploadPdf(docHash);

          // 3. Montar Objeto Final
          const finalNotification: NotificationItem = {
              id: notificationId, 
              documentHash: docHash, 
              notificante_uid: user.uid, 
              notificante_cpf: formData.sender.cpfCnpj.replace(/\D/g, ''),
              notificados_cpfs: [formData.recipient.cpfCnpj.replace(/\D/g, '')], 
              recipientName: formData.recipient.name, 
              recipientEmail: formData.recipient.email, 
              recipientPhone: formData.recipient.phone, 
              recipientDocument: formData.recipient.cpfCnpj, 
              recipientAddress: formatAddressString(formData.recipient.address),
              area: currentArea?.name || '', 
              species: formData.species, 
              facts: formData.facts, 
              subject: formData.species, 
              content: formData.generatedContent, 
              evidences: uploadedEvidences, 
              pdf_url: pdfUrl, 
              signatureBase64: signatureData || undefined, 
              createdAt: new Date().toISOString(), 
              status: NotificationStatus.SENT, // Já nasce Enviada/Paga
              paymentAmount: 57.92,
              paymentId: asaasPaymentId || undefined,
              paymentMethod: 'PIX',
              notificante_dados_expostos: { // Correção de estrutura
                  nome: formData.sender.name,
                  email: formData.sender.email,
                  telefone: formData.sender.phone
              }
          };

          // 4. Salvar Notificação no Firestore
          await saveNotification(finalNotification);

          // 5. Salvar Transação no Firestore
          const trans: Transaction = {
              id: asaasPaymentId || `TX-${Date.now()}`, 
              description: `Notificação - ${formData.species}`,
              amount: 57.92, 
              date: new Date().toISOString(), 
              status: 'Pago', 
              notificationId: notificationId, 
              recipientName: formData.recipient.name,
              userId: user.uid
          };
          await saveTransaction(user.uid, trans);

          // 6. Criar Reunião (Se houver)
          let finalMeet: Meeting | undefined;
          if (formData.scheduleMeeting) {
              finalMeet = {
                  id: `MEET-${Date.now()}`, hostUid: user.uid, hostName: user.displayName, title: `Conciliação: ${formData.species}`,
                  date: formData.meetingDate, time: formData.meetingTime, guestEmail: formData.recipient.email, 
                  meetLink: formData.meetLink || "https://meet.google.com/yjg-zhrg-rez",
                  createdAt: new Date().toISOString(), status: 'scheduled' 
              };
              await createMeeting(finalMeet);
          }

          // 7. Disparar Comunicações (E-mail / WhatsApp) com a URL Pública do PDF
          await dispatchCommunications(finalNotification);

          // 8. Sucesso Visual
          setCurrentStep(9);
          
      } catch (e: any) {
          console.error("Erro fatal ao salvar pós-pagamento:", e);
          alert("O pagamento foi confirmado, mas houve um erro ao salvar o documento. Entre em contato com o suporte com o ID: " + notificationId);
      } finally {
          setIsFinalizing(false);
      }
  };

  const generateAndUploadPdf = async (hash: string): Promise<string> => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Marca D'água
      doc.setTextColor(240, 240, 240);
      doc.setFontSize(60);
      doc.setFont("times", "bold");
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.1 }));
      doc.text("NOTIFY ORIGINAL", pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();

      // Cabeçalho
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      doc.text("NOTIFICAÇÃO EXTRAJUDICIAL", pageWidth / 2, 20, { align: "center" });
      doc.setLineWidth(0.5);
      doc.line(20, 25, pageWidth - 20, 25);

      // Metadados Topo
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Protocolo Digital: ${notificationId}`, pageWidth - 20, 15, { align: "right" });

      // Corpo
      doc.setFontSize(11);
      doc.setFont("times", "normal");
      doc.setTextColor(0, 0, 0);
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      const textLines = doc.splitTextToSize(formData.generatedContent, maxWidth);
      
      let cursorY = 35;
      textLines.forEach((line: string) => {
          if (cursorY > pageHeight - 30) {
              doc.addPage();
              cursorY = 20;
          }
          doc.text(line, margin, cursorY, { align: "justify", maxWidth: maxWidth });
          cursorY += 5;
      });

      // Assinatura e Carimbo
      if (signatureData) {
          if (cursorY > pageHeight - 60) { doc.addPage(); cursorY = 40; } else { cursorY += 20; }
          
          doc.addImage(signatureData, 'PNG', pageWidth / 2 - 20, cursorY - 15, 40, 15);
          doc.line(pageWidth / 2 - 40, cursorY, pageWidth / 2 + 40, cursorY);
          
          cursorY += 5;
          doc.setFontSize(10);
          doc.setFont("times", "bold");
          doc.text(formData.sender.name.toUpperCase(), pageWidth / 2, cursorY, { align: "center" });
          doc.setFontSize(9);
          doc.setFont("times", "normal");
          doc.text(`CPF: ${formData.sender.cpfCnpj}`, pageWidth / 2, cursorY + 4, { align: "center" });

          // Carimbo Digital
          doc.setDrawColor(37, 99, 235); // Blue
          doc.setLineWidth(0.5);
          doc.rect(pageWidth - 60, cursorY - 20, 40, 25);
          doc.setFontSize(7);
          doc.setTextColor(37, 99, 235);
          doc.text("ASSINADO DIGITALMENTE", pageWidth - 40, cursorY - 15, { align: "center" });
          doc.setTextColor(100);
          doc.text(`Hash: ${hash.substring(0, 10)}...`, pageWidth - 40, cursorY - 10, { align: "center" });
          doc.text(new Date().toLocaleString(), pageWidth - 40, cursorY - 5, { align: "center" });
      }

      // Rodapé
      const pages = doc.getNumberOfPages();
      for(let i=1; i<=pages; i++){
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Página ${i} de ${pages} | Hash: ${hash}`, pageWidth/2, pageHeight - 10, {align:"center"});
      }

      return await uploadSignedPdf(notificationId, doc.output('blob'), hash);
  };

  // --- START CHECKOUT ---
  const handleStartCheckout = async () => {
      if (!isSigned) return alert("Assinatura obrigatória.");
      setIsProcessingPayment(true);
      try {
          const payerData = role === 'representative' ? formData.representative : formData.sender;
          
          // Inicia Checkout (Retorna Pix Copia e Cola)
          // NOTA: Passamos os dados mas NÃO salvamos no DB ainda. O ID do Asaas servirá de rastreio.
          const checkout = await initiateCheckout(
              { id: notificationId, notificante_cpf: formData.sender.cpfCnpj } as any, 
              'single', 'PIX', null, 
              {
                  name: payerData.name || user.displayName,
                  cpfCnpj: payerData.cpfCnpj.replace(/\D/g, ''),
                  email: payerData.email || user.email,
                  phone: payerData.phone || ''
              }
          );
          
          if (checkout.success && checkout.pixData) {
              setPixData(checkout.pixData);
              setAsaasPaymentId(checkout.paymentId || null);
              setCurrentStep(8); 
          } else {
              alert("Erro ao gerar Pix: " + (checkout.error || "Dados inválidos."));
          }
      } catch (e: any) { alert("Erro: " + e.message); } finally { setIsProcessingPayment(false); }
  };

  // --- RENDERIZADORES DE STEP ---
  
  const renderStep1 = () => (
      <div className="animate-fade-in">
          <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-800">Qual a Natureza Jurídica?</h2>
              <p className="text-slate-500 mt-2">Selecione a área para que a IA calibre a legislação aplicável.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {LAW_AREAS.map(area => (
                  <button key={area.id} onClick={() => { setFormData(p => ({ ...p, areaId: area.id })); setCurrentStep(2); }} className="relative p-6 rounded-2xl border border-slate-100 bg-white hover:border-blue-500 hover:shadow-xl transition-all group overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-100 to-transparent rounded-bl-full -mr-8 -mt-8 group-hover:from-blue-100 transition-colors"></div>
                      <area.icon size={32} className="text-slate-400 group-hover:text-blue-600 mb-4 relative z-10 transition-colors"/>
                      <h3 className="font-bold text-slate-800 text-sm relative z-10">{area.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 relative z-10">{area.desc}</p>
                  </button>
              ))}
          </div>
      </div>
  );

  const renderStep2 = () => (
      <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="flex justify-between items-end mb-4">
              <div>
                  <h2 className="text-2xl font-bold text-slate-800">Narrativa dos Fatos</h2>
                  <p className="text-sm text-slate-500">Descreva o ocorrido. Seja claro e objetivo.</p>
              </div>
              <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  IA Ready <Sparkles size={10} className="inline ml-1"/>
              </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
              {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => setFormData(p => ({...p, facts: p.facts ? p.facts + "\n" + s : s}))} className="text-[10px] px-3 py-1.5 rounded-full border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition bg-white">
                      + {s}
                  </button>
              ))}
          </div>

          <div className="relative">
              <textarea value={formData.facts} onChange={e => setFormData({...formData, facts: e.target.value})} className="w-full h-64 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none resize-none text-slate-700 leading-relaxed" placeholder="Ex: No dia 15/03, contratei os serviços da empresa X para... Ocorre que até a presente data..."/>
              <div className="absolute bottom-4 right-4 text-xs text-slate-300 font-bold">{formData.facts.length} chars</div>
          </div>

          <div className="mt-6 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center relative hover:bg-slate-100 transition">
              <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if(e.target.files?.[0]) { const f=e.target.files[0]; setLocalFiles(p=>[...p, {id:Math.random().toString(), file:f, name:f.name, previewUrl:URL.createObjectURL(f), type:f.type.startsWith('image')?'image':'document'}]) } }} />
              <div className="flex items-center gap-2 text-slate-500">
                  <Copy size={18}/>
                  <span className="text-sm font-medium">Anexar Provas (PDF, Fotos, Prints)</span>
              </div>
              {localFiles.length > 0 && <div className="mt-3 flex gap-2 flex-wrap">{localFiles.map(f => <span key={f.id} className="text-xs bg-white px-2 py-1 rounded border shadow-sm">{f.name}</span>)}</div>}
          </div>

          <div className="flex justify-end mt-8">
              <button onClick={() => { if(!formData.facts) return alert("Preencha os fatos."); setCurrentStep(3); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition flex items-center">Próximo <ArrowRight size={16} className="ml-2"/></button>
          </div>
      </div>
  );

  // STEP 3 (Partes) mantido no core, renderização simplificada aqui
  const renderStep3 = () => (
      <div className="max-w-4xl mx-auto animate-fade-in">
          {partiesStep === 'role_selection' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-10">
                  <button onClick={() => { setRole('self'); setPartiesStep('forms'); }} className="bg-white p-8 rounded-3xl border border-slate-200 hover:border-blue-500 hover:shadow-2xl transition group text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-10 transition"></div>
                      <User size={48} className="mx-auto mb-4 text-slate-300 group-hover:text-blue-600 transition-colors"/>
                      <h3 className="text-xl font-bold text-slate-800 relative z-10">Pessoa Física</h3>
                      <p className="text-sm text-slate-500 mt-2 relative z-10">Notificar em meu nome</p>
                  </button>
                  <button onClick={() => { setRole('representative'); setPartiesStep('forms'); }} className="bg-white p-8 rounded-3xl border border-slate-200 hover:border-purple-500 hover:shadow-2xl transition group text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-purple-50 opacity-0 group-hover:opacity-10 transition"></div>
                      <Briefcase size={48} className="mx-auto mb-4 text-slate-300 group-hover:text-purple-600 transition-colors"/>
                      <h3 className="text-xl font-bold text-slate-800 relative z-10">Representante</h3>
                      <p className="text-sm text-slate-500 mt-2 relative z-10">Advogado ou Procurador</p>
                  </button>
              </div>
          ) : (
              <div>
                  <button onClick={() => setPartiesStep('role_selection')} className="mb-6 text-xs font-bold text-slate-400 hover:text-slate-800 flex items-center"><ChevronLeft size={14}/> Voltar</button>
                  {role === 'representative' && <PersonForm title="Seus Dados" section="representative" data={formData.representative} colorClass="border-purple-500" onInputChange={(s:any,f:any,v:any)=>setFormData(p=>({...p,[s]:{...p[s as keyof typeof p],[f]:v}}))} onAddressChange={(s:any,f:any,v:any)=>setFormData(p=>({...p,[s]:{...p[s as keyof typeof p],address:{...(p[s as keyof typeof p] as any).address,[f]:v}}}))} />}
                  <PersonForm title="Remetente" section="sender" data={formData.sender} colorClass="border-blue-500" onInputChange={(s:any,f:any,v:any)=>setFormData(p=>({...p,[s]:{...p[s as keyof typeof p],[f]:v}}))} onAddressChange={(s:any,f:any,v:any)=>setFormData(p=>({...p,[s]:{...p[s as keyof typeof p],address:{...(p[s as keyof typeof p] as any).address,[f]:v}}}))} isCompanyAllowed={role==='representative'}/>
                  <PersonForm title="Destinatário" section="recipient" data={formData.recipient} colorClass="border-red-500" onInputChange={(s:any,f:any,v:any)=>setFormData(p=>({...p,[s]:{...p[s as keyof typeof p],[f]:v}}))} onAddressChange={(s:any,f:any,v:any)=>setFormData(p=>({...p,[s]:{...p[s as keyof typeof p],address:{...(p[s as keyof typeof p] as any).address,[f]:v}}}))} isCompanyAllowed={true}/>
                  <div className="flex justify-end"><button onClick={() => setCurrentStep(4)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg">Continuar</button></div>
              </div>
          )}
      </div>
  );

  const renderStep4 = () => (
      <div className="max-w-xl mx-auto text-center py-10 animate-fade-in">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Video size={36}/></div>
          <h2 className="text-2xl font-bold mb-2">Propor Conciliação?</h2>
          <p className="text-slate-500 mb-8 px-8">A plataforma pode criar um link automático de videochamada Google Meet e inseri-lo na notificação.</p>
          <div className="flex justify-center gap-4 mb-8">
              <button onClick={() => setFormData({...formData, scheduleMeeting: true})} className={`px-8 py-4 rounded-2xl font-bold border transition-all ${formData.scheduleMeeting ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-200' : 'bg-white text-slate-600'}`}>Sim, agendar</button>
              <button onClick={() => setFormData({...formData, scheduleMeeting: false})} className={`px-8 py-4 rounded-2xl font-bold border transition-all ${!formData.scheduleMeeting ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600'}`}>Não</button>
          </div>
          {formData.scheduleMeeting && <div className="text-left bg-slate-50 p-6 rounded-2xl border border-slate-200"><input type="date" className="w-full mb-3 p-3 rounded-lg border" onChange={e => setFormData({...formData, meetingDate: e.target.value})}/><input type="time" className="w-full p-3 rounded-lg border" onChange={e => setFormData({...formData, meetingTime: e.target.value})}/></div>}
          <button onClick={() => setCurrentStep(5)} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-bold mt-8 shadow-lg hover:scale-105 transition">Confirmar</button>
      </div>
  );

  const renderStep5 = () => (
      <div className="max-w-2xl mx-auto text-center py-20">
          {!isGenerating ? (
              <div className="animate-fade-in">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                      <Sparkles size={64} className="text-purple-600 relative z-10 mx-auto"/>
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-slate-900">IA Jurídica</h2>
                  <p className="text-slate-500 mb-8">Nossa inteligência artificial irá redigir o documento com base nas leis vigentes e nos fatos narrados.</p>
                  <button onClick={async () => {
                      setIsGenerating(true);
                      try {
                          const attachments: Attachment[] = localFiles.map(lf => ({ file: lf.file, preview: lf.previewUrl, type: lf.type }));
                          let details = `REMETENTE: ${formData.sender.name}, CPF/CNPJ: ${formData.sender.cpfCnpj}\nDESTINATÁRIO: ${formData.recipient.name}, CPF/CNPJ: ${formData.recipient.cpfCnpj}\nFATOS: ${formData.facts}`;
                          const text = await generateNotificationText(formData.recipient.name, formData.species, details, 'Formal', attachments, { area: currentArea?.name || '', species: formData.species, areaDescription: currentArea?.desc || '' });
                          setFormData(p => ({ ...p, generatedContent: text })); setCurrentStep(6);
                      } catch (e: any) { alert("Erro IA: " + e.message); } finally { setIsGenerating(false); }
                  }} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all">Gerar Documento</button>
              </div>
          ) : (
              <div className="flex flex-col items-center">
                  <Loader2 size={64} className="animate-spin text-blue-600 mb-6"/>
                  <p className="text-slate-800 font-bold text-lg animate-pulse">Analisando jurisprudência...</p>
                  <p className="text-slate-400 text-sm mt-2">Redigindo cláusulas e fundamentação</p>
              </div>
          )}
      </div>
  );

  const renderStep6 = () => (
      <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="bg-white shadow-2xl border border-slate-100 p-12 min-h-[600px] mb-8 font-serif text-justify whitespace-pre-wrap leading-relaxed text-slate-800 rounded-sm relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-900 via-slate-800 to-blue-900"></div>
              {formData.generatedContent}
              <div className="mt-16 pt-8 border-t border-slate-300 text-center">
                  {isSigned && signatureData ? (
                      <div className="relative inline-block px-10 py-4 border-2 border-blue-600 rounded-lg">
                          <img src={signatureData} className="h-12 mx-auto filter brightness-0"/>
                          <div className="absolute -right-6 -bottom-6 bg-blue-600 text-white text-[8px] p-2 rounded-full shadow-lg font-mono">
                              <div>HASH: {docHash.substring(0,8)}</div>
                              <div>{new Date().toLocaleDateString()}</div>
                          </div>
                      </div>
                  ) : (
                      <div className="border-2 dashed border-slate-300 h-40 flex flex-col items-center justify-center bg-slate-50 rounded-xl relative group hover:border-blue-400 transition-colors cursor-crosshair">
                          <span className="text-slate-400 text-sm mb-2 pointer-events-none">Assine aqui com o mouse ou dedo</span>
                          <canvas 
                              ref={canvasRef} 
                              width={500} 
                              height={160} 
                              onMouseDown={(e)=>{e.preventDefault(); const ctx=canvasRef.current?.getContext('2d'); if(!ctx)return; setIsDrawing(true); const rect=canvasRef.current!.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(e.clientX-rect.left, e.clientY-rect.top); ctx.lineWidth=3; ctx.lineCap='round'; ctx.strokeStyle='#000066';}} 
                              onMouseMove={(e)=>{if(!isDrawing)return; const ctx=canvasRef.current?.getContext('2d'); const rect=canvasRef.current!.getBoundingClientRect(); ctx?.lineTo(e.clientX-rect.left, e.clientY-rect.top); ctx?.stroke();}} 
                              onMouseUp={()=>{setIsDrawing(false); if(canvasRef.current) setSignatureData(canvasRef.current.toDataURL()); setIsSigned(true);}}
                              className="absolute inset-0 w-full h-full"
                          />
                      </div>
                  )}
                  {!isSigned && <button onClick={()=>{const ctx=canvasRef.current?.getContext('2d'); ctx?.clearRect(0,0,500,160); setSignatureData(null); setIsSigned(false);}} className="text-xs text-red-400 mt-2 underline">Limpar</button>}
              </div>
          </div>
          <div className="flex justify-end gap-4">
              <button onClick={() => setCurrentStep(5)} className="text-slate-500 font-bold px-4">Refazer IA</button>
              <button onClick={() => { if(!isSigned) return alert("Assine o documento."); setCurrentStep(7); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg">Avançar</button>
          </div>
      </div>
  );

  const renderStep7 = () => (
      <div className="max-w-4xl mx-auto animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-10 items-center py-8">
          <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Envio & Rastreamento</h2>
              <div className="space-y-6">
                  <div className="flex gap-4">
                      <div className="p-3 bg-green-100 text-green-700 rounded-xl h-fit"><CheckCircle2 size={24}/></div>
                      <div>
                          <h4 className="font-bold text-slate-800">Validade Jurídica</h4>
                          <p className="text-sm text-slate-500">Documento assinado digitalmente com carimbo de tempo e hash antifraude.</p>
                      </div>
                  </div>
                  <div className="flex gap-4">
                      <div className="p-3 bg-blue-100 text-blue-700 rounded-xl h-fit"><Eye size={24}/></div>
                      <div>
                          <h4 className="font-bold text-slate-800">Rastreamento Total</h4>
                          <p className="text-sm text-slate-500">Saiba exatamente quando o destinatário recebeu e abriu o documento.</p>
                      </div>
                  </div>
                  <div className="flex gap-4">
                      <div className="p-3 bg-purple-100 text-purple-700 rounded-xl h-fit"><Rocket size={24}/></div>
                      <div>
                          <h4 className="font-bold text-slate-800">Envio Multicanal</h4>
                          <p className="text-sm text-slate-500">Disparo simultâneo via E-mail Registrado e WhatsApp Oficial.</p>
                      </div>
                  </div>
              </div>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 text-center">
              <div className="w-20 h-20 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-slate-300">
                  <Zap size={32}/>
              </div>
              <h3 className="text-2xl font-bold text-slate-800">R$ 57,92</h3>
              <p className="text-slate-500 text-sm mb-8">Taxa única de processamento e envio</p>
              <button onClick={handleStartCheckout} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-xl transition-all hover:scale-105 flex items-center justify-center">
                  {isProcessingPayment ? <Loader2 className="animate-spin"/> : "Gerar Pagamento"}
              </button>
              <p className="text-xs text-slate-400 mt-4">Ambiente seguro 256-bit SSL</p>
          </div>
      </div>
  );

  const renderStep8 = () => (
      <div className="max-w-md mx-auto text-center py-10 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Pagamento Seguro</h2>
          {pixData ? (
              <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200">
                  <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <img src={`data:image/png;base64,${pixData.encodedImage}`} className="w-48 h-48 mx-auto mix-blend-multiply" />
                  </div>
                  <div className="flex gap-2 mb-6">
                      <input readOnly value={pixData.payload} className="w-full text-xs bg-slate-100 p-3 rounded-lg border border-slate-200 text-slate-500 font-mono truncate"/>
                      <button onClick={() => {navigator.clipboard.writeText(pixData.payload); alert("Copiado!");}} className="bg-blue-100 text-blue-600 px-4 rounded-lg hover:bg-blue-200 transition"><Copy size={18}/></button>
                  </div>
                  
                  {isFinalizing ? (
                      <div className="flex items-center justify-center text-blue-600 font-bold text-sm bg-blue-50 p-4 rounded-xl animate-pulse">
                          <Loader2 size={18} className="animate-spin mr-2"/>
                          Processando e Salvando Documentos...
                      </div>
                  ) : (
                      <div className="flex items-center justify-center text-emerald-600 font-bold text-sm bg-emerald-50 p-4 rounded-xl animate-pulse">
                          <Loader2 size={18} className="animate-spin mr-2"/>
                          Aguardando confirmação automática...
                      </div>
                  )}
                  <p className="text-xs text-slate-400 mt-4 px-4">Após o pagamento, não feche esta janela. O sistema irá processar e salvar sua notificação automaticamente.</p>
              </div>
          ) : <Loader2 className="animate-spin mx-auto text-slate-400"/>}
      </div>
  );

  const renderStep9 = () => (
      <div className="max-w-lg mx-auto text-center py-20 animate-fade-in">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
              <CheckCircle2 size={48}/>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Sucesso!</h2>
          <p className="text-slate-500 mb-8">Sua notificação foi registrada, assinada e enviada.</p>
          <div className="bg-slate-50 p-6 rounded-2xl mb-8 text-left border border-slate-200">
              <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Protocolo</span>
                  <span className="text-xs font-mono text-slate-800">{notificationId}</span>
              </div>
              <div className="flex justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">ENVIADA</span>
              </div>
          </div>
          <button onClick={onBack} className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold shadow-xl hover:scale-105 transition">Ir para o Painel</button>
      </div>
  );

  return (
      <div className="max-w-6xl mx-auto pb-24 relative font-sans">
          {/* Header Compacto */}
          {currentStep < 9 && (
              <div className="flex items-center justify-between mb-8 px-4">
                  <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition"><ChevronLeft size={24}/></button>
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Etapa {currentStep} de 9</span>
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 transition-all duration-500" style={{width: `${(currentStep/9)*100}%`}}></div>
                      </div>
                  </div>
              </div>
          )}

          {/* Renderização Condicional */}
          <div className="min-h-[500px]">
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}
              {currentStep === 6 && renderStep6()}
              {currentStep === 7 && renderStep7()}
              {currentStep === 8 && renderStep8()}
              {currentStep === 9 && renderStep9()}
          </div>
      </div>
  );
};

export default NotificationCreator;
