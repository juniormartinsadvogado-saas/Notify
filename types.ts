
export enum NotificationStatus {
    DRAFT = 'Criada', // Alterado de Rascunho para Criada
    GENERATING = 'Gerando IA',
    PENDING_PAYMENT = 'Aguardando Pagamento',
    SENT = 'Enviada',
    DELIVERED = 'Entregue',
    READ = 'Lida'
  }
  
  export interface EvidenceItem {
    id: string;
    name: string;
    url: string; // Firebase Storage URL
    type: 'image' | 'video' | 'document';
    storagePath: string; // Para permitir exclusão
    createdAt: string;
    isLoading?: boolean; // Propriedade para UI de carregamento
  }

  export interface NotificationItem {
    id: string;
    senderUid: string; // ID do criador
    senderName: string; // Snapshot do nome para agilidade
    senderPhotoUrl?: string; // Snapshot da foto
    senderEmail: string;

    recipientName: string;
    recipientEmail: string;
    recipientCpf: string; // Chave para vínculo com usuário secundário
    
    area: string;
    species: string;
    facts: string;
    
    subject: string;
    content: string; // Texto da notificação
    pdfUrl?: string; // URL do PDF assinado no Storage
    signatureBase64?: string; // Assinatura digital em Base64
    
    evidences: EvidenceItem[]; // Lista de arquivos anexados
    
    createdAt: string;
    status: NotificationStatus;
    
    paymentMethod?: 'pix' | 'credit_card';
    paymentAmount?: number;
  }
  
  export interface Meeting {
    id: string;
    hostUid: string;
    hostName: string;
    title: string;
    guestEmail?: string;
    guestCpf?: string; // Para vínculo com usuário secundário
    date: string;
    time: string;
    meetLink: string;
    createdAt: string;
    status: 'scheduled' | 'completed' | 'canceled';
  }
  
  export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    status: 'Pago' | 'Pendente' | 'Falha' | 'Reembolsado';
  }

  export interface FileItem {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    storagePath: string;
    createdAt: string;
    userNotes?: string;
    aiSummary?: string;
  }

  export interface Attachment {
    file: File;
    preview: string;
    type: 'image' | 'video' | 'document';
  }
  
  export enum ViewState {
    DASHBOARD = 'dashboard',
    CREATE_NOTIFICATION = 'create_notification',
    
    // NOTIFICAÇÕES (Subpastas)
    NOTIFICATIONS_CREATED = 'notifications_created', // Rascunhos/Criadas
    NOTIFICATIONS_DELIVERED = 'notifications_delivered', // Entregues/Enviadas
    NOTIFICATIONS_PENDING = 'notifications_pending', // Aguardando Pagamento

    // CONCILIAÇÕES (Subpastas)
    CONCILIATIONS_SCHEDULED = 'conciliations_scheduled',
    CONCILIATIONS_CANCELED = 'conciliations_canceled',
    CONCILIATIONS_DONE = 'conciliations_done',

    // PAGAMENTOS (Subpastas)
    PAYMENTS_CONFIRMED = 'payments_confirmed',
    PAYMENTS_PENDING = 'payments_pending',
    PAYMENTS_REFUNDED = 'payments_refunded',

    // CONFIGURAÇÕES (Subpastas)
    SETTINGS_ACCOUNT = 'settings_account',
    SETTINGS_PLATFORM = 'settings_platform',

    SETTINGS = 'settings', // Fallback

    // Additional views
    RECEIVED_NOTIFICATIONS = 'received_notifications',
    MONITORING = 'monitoring',
    MEETINGS = 'meetings',
    BILLING = 'billing',
    FILES = 'files'
  }