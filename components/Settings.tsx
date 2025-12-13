
import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Shield, Bell, Moon, Database, Save, CheckCircle, Lock, Phone, FileText, Camera, Loader2, Trash2, AlertTriangle, X, Palette, Key, LogOut, Info } from 'lucide-react';
import { getUserProfile, updateUserProfile, uploadUserPhoto, deleteFullUserAccount, UserData } from '../services/userService';
import { auth } from '../services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

interface SettingsProps {
    subView?: 'account' | 'platform';
    onThemeChange?: (darkMode: boolean, color: string) => void;
    initialTheme?: { darkMode: boolean, themeColor: string };
    user?: any; 
}

type SecurityAction = 'UPDATE_PROFILE' | 'CHANGE_PASSWORD' | 'DELETE_ACCOUNT' | null;

const MASKS = {
    cpf: (value: string) => {
        return value.replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
            .substring(0, 14); 
    },
    phone: (value: string) => {
      const v = value.replace(/\D/g, '');
      return v.replace(/^(\d{2})(\d)/, '($1) $2')
              .replace(/(\d)(\d{4})$/, '$1-$2')
              .substring(0, 15);
    }
};

const Settings: React.FC<SettingsProps> = ({ subView = 'account', onThemeChange, initialTheme, user: propUser }) => {
  const savedUser = localStorage.getItem('mock_session_user');
  const user = propUser || (savedUser ? JSON.parse(savedUser) : null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form Data (Profile)
  const [formData, setFormData] = useState<Partial<UserData>>({
    name: user?.displayName || '',
    email: user?.email || '',
    cpf: '',
    phone: '',
  });

  // Form Data (Password Change)
  const [passwordData, setPasswordData] = useState({
      newPassword: '',
      confirmNewPassword: ''
  });

  const [currentPhoto, setCurrentPhoto] = useState<string>(user?.photoURL || '');
  const [loading, setLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });

  // Security Modal State
  const [securityModal, setSecurityModal] = useState<{ isOpen: boolean; action: SecurityAction }>({
      isOpen: false,
      action: null
  });
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(initialTheme?.darkMode || false);
  const [autoSave, setAutoSave] = useState(true);
  const [themeColor, setThemeColor] = useState(initialTheme?.themeColor || 'blue');

  useEffect(() => {
    const loadProfile = async () => {
        if(user) {
            const profile = await getUserProfile(user.uid);
            
            const profileData = {
                name: profile?.name || user.displayName || '',
                email: profile?.email || user.email || '',
                cpf: profile?.cpf || '',
                phone: profile?.phone || ''
            };

            setFormData(profileData);
            
            if (profile?.photoUrl) {
                setCurrentPhoto(profile.photoUrl);
            } else if (user.photoURL) {
                setCurrentPhoto(user.photoURL);
            }
            setLoading(false);
        }
    };
    loadProfile();
  }, [user]);

  useEffect(() => {
      if (onThemeChange) {
          onThemeChange(darkMode, themeColor);
      }
  }, [darkMode, themeColor]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cpf') {
        newValue = MASKS.cpf(value);
    } else if (name === 'phone') {
        newValue = MASKS.phone(value);
    }

    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if(!user || !e.target.files || !e.target.files[0]) return;
      
      setIsUploadingPhoto(true);
      const file = e.target.files[0];

      try {
          const downloadUrl = await uploadUserPhoto(user.uid, file);
          setCurrentPhoto(downloadUrl);
          await updateUserProfile(user.uid, { photoUrl: downloadUrl });
          setFeedbackMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
      } catch (error) {
          console.error("Erro upload foto", error);
          setFeedbackMessage({ type: 'error', text: 'Erro ao enviar foto.' });
      } finally {
          setIsUploadingPhoto(false);
          setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 3000);
      }
  };

  const initiateUpdateProfile = () => {
      setFeedbackMessage({ type: '', text: '' });
      if (!formData.name || !formData.cpf) {
          setFeedbackMessage({ type: 'error', text: 'Nome e CPF são obrigatórios.' });
          return;
      }
      setSecurityModal({ isOpen: true, action: 'UPDATE_PROFILE' });
  };

  const initiateChangePassword = () => {
      setFeedbackMessage({ type: '', text: '' });
      if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
          setFeedbackMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
          return;
      }
      if (passwordData.newPassword !== passwordData.confirmNewPassword) {
          setFeedbackMessage({ type: 'error', text: 'As senhas não coincidem.' });
          return;
      }
      setSecurityModal({ isOpen: true, action: 'CHANGE_PASSWORD' });
  };

  const initiateDeleteAccount = () => {
      setSecurityModal({ isOpen: true, action: 'DELETE_ACCOUNT' });
  };

  const executeAction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentPasswordInput || !auth.currentUser) return;
      
      setIsProcessingAction(true);

      try {
          // REAUTENTICAÇÃO REAL COM FIREBASE
          const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPasswordInput);
          await reauthenticateWithCredential(auth.currentUser, credential);

          if (securityModal.action === 'UPDATE_PROFILE') {
              if (user) {
                  await updateUserProfile(user.uid, {
                      name: formData.name,
                      phone: formData.phone,
                      cpf: formData.cpf 
                  });
                  setFeedbackMessage({ type: 'success', text: 'Dados cadastrais atualizados!' });
              }
          } 
          else if (securityModal.action === 'CHANGE_PASSWORD') {
              await updatePassword(auth.currentUser, passwordData.newPassword);
              setFeedbackMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
              setPasswordData({ newPassword: '', confirmNewPassword: '' });
          } 
          else if (securityModal.action === 'DELETE_ACCOUNT') {
              if (user) {
                  await deleteFullUserAccount(user);
                  await auth.currentUser.delete(); // Deleta do Firebase Auth
                  localStorage.removeItem('mock_session_user');
                  window.location.reload(); 
                  return;
              }
          }

          setSecurityModal({ isOpen: false, action: null });
          setCurrentPasswordInput('');

      } catch (error: any) {
          console.error("Erro na ação de segurança:", error);
          if (error.code === 'auth/wrong-password') {
              setFeedbackMessage({ type: 'error', text: 'Senha incorreta.' });
          } else if (error.code === 'auth/too-many-requests') {
              setFeedbackMessage({ type: 'error', text: 'Muitas tentativas. Tente mais tarde.' });
          } else {
              setFeedbackMessage({ type: 'error', text: 'Erro ao processar solicitação.' });
          }
      } finally {
          setIsProcessingAction(false);
          setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 5000);
      }
  };

  const closeSecurityModal = () => {
      setSecurityModal({ isOpen: false, action: null });
      setCurrentPasswordInput('');
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-slate-400" size={32} />
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl relative">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-2xl font-bold">{subView === 'account' ? 'Minha Conta' : 'Painel & Plataforma'}</h2>
          <p className="opacity-70">
             {subView === 'account' ? 'Gerencie seus dados pessoais e segurança.' : 'Personalize sua experiência na plataforma.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* VIEW: CONTA */}
        {subView === 'account' && (
            <div className="lg:col-span-2 space-y-8 animate-slide-in-down">
                
                {/* MENSAGEM DE FEEDBACK GERAL */}
                {feedbackMessage.text && (
                    <div className={`p-4 rounded-xl flex items-center shadow-sm animate-fade-in ${feedbackMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                        {feedbackMessage.type === 'error' ? <AlertTriangle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}
                        <span className="font-medium">{feedbackMessage.text}</span>
                    </div>
                )}

                {/* SEÇÃO 1: DADOS PESSOAIS */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex items-center space-x-2 mb-6 border-b border-slate-100 pb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <User size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Dados Pessoais</h3>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Foto / Avatar */}
                        <div className="flex flex-col items-center space-y-3">
                            <div className="h-32 w-32 rounded-full border-4 border-slate-50 shadow-inner bg-slate-200 overflow-hidden relative group cursor-pointer">
                                {currentPhoto ? (
                                <img src={currentPhoto} alt="User" className="h-full w-full object-cover" />
                                ) : (
                                <div className="h-full w-full flex items-center justify-center text-slate-400 bg-slate-100 text-3xl font-bold">
                                    {formData.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                )}
                                {/* Overlay for upload */}
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    {isUploadingPhoto ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white" />}
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handlePhotoUpload} 
                            />
                            <span className="text-xs text-slate-400">Toque na foto para alterar</span>
                        </div>

                        {/* Formulário */}
                        <div className="flex-1 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Nome Completo</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <input 
                                    type="text" 
                                    name="name"
                                    value={formData.name} 
                                    onChange={handleInputChange}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 font-medium" 
                                    placeholder="Seu nome completo"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">CPF</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input 
                                        type="text" 
                                        name="cpf"
                                        maxLength={14}
                                        value={formData.cpf} 
                                        onChange={handleInputChange}
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 font-medium" 
                                        placeholder="000.000.000-00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">WhatsApp</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <span className="absolute left-9 top-3 text-slate-400 font-bold text-sm pointer-events-none">+55</span>
                                        <input 
                                        type="text" 
                                        name="phone"
                                        maxLength={15}
                                        value={formData.phone} 
                                        onChange={handleInputChange}
                                        className="w-full pl-16 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 font-medium" 
                                        placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">E-mail (Login)</label>
                                <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                                <input 
                                    type="email" 
                                    value={formData.email} 
                                    disabled
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed opacity-70" 
                                />
                                <div className="absolute right-3 top-3 text-xs text-slate-400">
                                    <Lock size={14} />
                                </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button 
                                onClick={initiateUpdateProfile}
                                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-800 transition-all shadow-lg flex items-center"
                                >
                                <Save size={16} className="mr-2" />
                                Salvar Dados Cadastrais
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SEÇÃO 2: SEGURANÇA (Alterar Senha) */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-2 mb-6 border-b border-slate-100 pb-4">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <Shield size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Segurança</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                             <p className="text-sm text-slate-500 mb-4">
                                 Para atualizar sua senha ou realizar ações sensíveis, solicitaremos sua senha atual para reautenticação imediata.
                             </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Nova Senha</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-3 text-slate-400" size={16} />
                                <input 
                                    type="password"
                                    name="newPassword"
                                    value={passwordData.newPassword}
                                    onChange={handlePasswordChange}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm text-slate-800"
                                    placeholder="Nova senha"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Confirmar Nova Senha</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-3 text-slate-400" size={16} />
                                <input 
                                    type="password"
                                    name="confirmNewPassword"
                                    value={passwordData.confirmNewPassword}
                                    onChange={handlePasswordChange}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm text-slate-800"
                                    placeholder="Repita a nova senha"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                             <button 
                                onClick={initiateChangePassword}
                                className="bg-white border border-slate-200 text-slate-700 hover:text-purple-600 hover:border-purple-200 px-6 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center shadow-sm"
                                >
                                <Key size={16} className="mr-2" />
                                Alterar Senha
                             </button>
                        </div>
                    </div>
                </div>

                {/* SEÇÃO 3: ZONA DE PERIGO */}
                <div className="mt-10 pt-6 border-t border-slate-100">
                    <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-red-50 rounded-xl border border-red-100 gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl border border-red-100 text-red-500 shadow-sm">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-red-700">Zona de Perigo</h4>
                                <p className="text-sm text-red-600/80 mt-1">
                                    A exclusão da conta é permanente. Todos os seus dados, documentos e histórico serão apagados irrecuperavelmente.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={initiateDeleteAccount}
                            className="w-full md:w-auto px-6 py-3 bg-white border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                        >
                            <Trash2 size={16} className="mr-2" />
                            Excluir Minha Conta
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW: PAINEL / PLATAFORMA */}
        {subView === 'platform' && (
            <div className="space-y-6 lg:col-span-2 animate-slide-in-down">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full">
                <div className="flex items-center space-x-2 mb-6 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <Palette size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Aparência e Preferências</h3>
                </div>

                <div className="space-y-8">
                {/* Cores */}
                <div>
                     <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Cor de Destaque</h4>
                     <div className="flex gap-4">
                         {['blue', 'purple', 'green', 'orange'].map(color => (
                             <button 
                                key={color}
                                onClick={() => setThemeColor(color)}
                                className={`w-12 h-12 rounded-full border-4 transition-all ${themeColor === color ? 'border-slate-300 scale-110' : 'border-transparent'}`}
                                style={{backgroundColor: color === 'blue' ? '#3B82F6' : color === 'purple' ? '#9333EA' : color === 'green' ? '#22C55E' : '#F97316'}}
                             />
                         ))}
                     </div>
                </div>

                {/* Notificações */}
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Sistema</h4>
                    <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-3">
                            <Bell size={18} className="text-slate-500" />
                            <div>
                                <span className="block text-sm font-medium text-slate-700">Notificações por Email</span>
                                <span className="block text-xs text-slate-400">Receba atualizações sobre seus processos.</span>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={notificationsEnabled} onChange={() => setNotificationsEnabled(!notificationsEnabled)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-3">
                            <Moon size={18} className="text-slate-500" />
                            <div>
                                <span className="block text-sm font-medium text-slate-700">Modo Escuro (Beta)</span>
                                <span className="block text-xs text-slate-400">Alterar tema da interface.</span>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={darkMode} onChange={() => setDarkMode(!darkMode)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-3">
                            <Database size={18} className="text-slate-500" />
                            <div>
                                <span className="block text-sm font-medium text-slate-700">Salvar Automaticamente</span>
                                <span className="block text-xs text-slate-400">Salvar rascunhos durante a edição.</span>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={autoSave} onChange={() => setAutoSave(!autoSave)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    </div>
                </div>
                </div>
            </div>
            </div>
        )}
      </div>

      {/* UNIFIED SECURITY MODAL */}
      {securityModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
                  
                  {/* Modal Header Color Strip */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                      securityModal.action === 'DELETE_ACCOUNT' ? 'bg-red-500' : 'bg-slate-900'
                  }`}></div>
                  
                  <button 
                    onClick={closeSecurityModal}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>

                  <div className="p-8">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto border ${
                          securityModal.action === 'DELETE_ACCOUNT' 
                            ? 'bg-red-50 text-red-600 border-red-100' 
                            : 'bg-slate-50 text-slate-700 border-slate-100'
                      }`}>
                          {securityModal.action === 'DELETE_ACCOUNT' ? <AlertTriangle size={32} /> : <Lock size={32} />}
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                          {securityModal.action === 'DELETE_ACCOUNT' ? 'Confirmar Exclusão' : 'Confirmação de Segurança'}
                      </h3>
                      <p className="text-slate-500 text-center text-sm mb-6 px-4">
                          {securityModal.action === 'DELETE_ACCOUNT' 
                            ? 'Para sua segurança, confirme sua senha para excluir permanentemente sua conta.'
                            : securityModal.action === 'CHANGE_PASSWORD'
                                ? 'Autenticação necessária. Confirme sua senha atual para definir a nova senha.'
                                : 'Confirme sua senha para salvar as alterações nos dados cadastrais.'
                          }
                      </p>

                      <form onSubmit={executeAction} className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Senha Atual</label>
                              <div className="relative">
                                  <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                                  <input 
                                      type="password" 
                                      value={currentPasswordInput}
                                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                                      placeholder="Digite sua senha"
                                      required
                                      autoFocus
                                  />
                              </div>
                          </div>

                          <div className="flex gap-3 mt-6">
                              <button
                                  type="button"
                                  onClick={closeSecurityModal}
                                  disabled={isProcessingAction}
                                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                              >
                                  Cancelar
                              </button>
                              <button
                                  type="submit"
                                  disabled={isProcessingAction || !currentPasswordInput}
                                  className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                                      securityModal.action === 'DELETE_ACCOUNT' 
                                      ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                                      : 'bg-slate-900 hover:bg-slate-800 shadow-slate-300'
                                  }`}
                              >
                                  {isProcessingAction ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
