
export enum NotificationStatus {
    DRAFT = 'Criada',
    GENERATING = 'Gerando IA',
    PENDING_PAYMENT = 'Aguardando Pagamento',
    SENT = 'Enviada',
    DELIVERED = 'Entregue',
    READ = 'Lida'
}
  
export interface EvidenceItem {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video' | 'document';
    storagePath: string;
    createdAt: string;
    isLoading?: boolean;
}

// Interface atualizada conforme Regra de Negócio Fase 2
export interface NotificationItem {
    id: string;
    
    // Dados do Notificante (Quem envia)
    notificante_uid: string;
    notificante_cpf: string;
    notificante_dados_expostos: {
        nome: string;
        email: string;
        telefone: string;
        foto_url?: string;
    };

    // Dados dos Notificados (Quem recebe - Array para validação de segurança)
    notificados_cpfs: string[]; // Array de CPFs (apenas números)
    
    // Dados do Destinatário (Para exibição e Envios)
    recipientName: string;
    recipientEmail: string;
    recipientPhone?: string;
    recipientDocument?: string; // CPF ou CNPJ formatado
    recipientAddress?: string; // Endereço completo formatado

    // Conteúdo
    area: string;
    species: string;
    facts: string;
    subject: string;
    content: string;
    
    // Arquivos
    pdf_url?: string; // Caminho no Storage: /notificacoes_pdfs/$ID.pdf
    evidences: EvidenceItem[];
    signatureBase64?: string;
    documentHash?: string; // Novo campo para o Hash único

    // Metadados
    createdAt: string;
    status: NotificationStatus; // 'pendente' ou 'pago' (mapeado para enum)
    paymentAmount?: number;

    // Rastreamento Granular (Novo)
    emailStatus?: 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED';
    whatsappStatus?: 'SENT' | 'DELIVERED' | 'READ';
    whatsappMessageId?: string; // ID interno da Z-API para correlação
    readAt?: string;
    deliveredAt?: string;
}
  
export interface Meeting {
    id: string;
    hostUid: string;
    hostName: string;
    title: string;
    guestEmail?: string;
    guestCpf?: string;
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
    recipientName?: string; // Novo: Nome do destinatário da notificação
    notificationId?: string; // Novo: ID da notificação vinculada
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
    
    NOTIFICATIONS_CREATED = 'notifications_created',
    NOTIFICATIONS_DELIVERED = 'notifications_delivered',
    NOTIFICATIONS_PENDING = 'notifications_pending',

    CONCILIATIONS_SCHEDULED = 'conciliations_scheduled',
    CONCILIATIONS_CANCELED = 'conciliations_canceled',
    CONCILIATIONS_DONE = 'conciliations_done',

    PAYMENTS_CONFIRMED = 'payments_confirmed',
    PAYMENTS_PENDING = 'payments_pending',
    PAYMENTS_REFUNDED = 'payments_refunded',

    SUBSCRIPTION_PLAN = 'subscription_plan',
    SUBSCRIPTION_HISTORY = 'subscription_history',

    SETTINGS_ACCOUNT = 'settings_account',
    SETTINGS_PLATFORM = 'settings_platform',
    SETTINGS = 'settings',

    RECEIVED_NOTIFICATIONS = 'received_notifications',
    MONITORING = 'monitoring',
    MEETINGS = 'meetings',
    BILLING = 'billing',
    FILES = 'files'
}
