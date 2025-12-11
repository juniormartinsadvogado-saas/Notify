
import React, { useState, useRef } from 'react';
import { Mail, Lock, Loader2, User, CheckCircle, AlertCircle, Phone, FileText, Camera, Eye, EyeOff, ArrowLeft, RefreshCw, LogIn } from 'lucide-react';
import { auth } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { createUserProfile, uploadUserPhoto } from '../services/userService';

interface LoginProps {
  onLogin: (user: any) => void;
}

const LogoY = () => (
  <svg width="60" height="60" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-xl rounded-full">
    <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z" fill="black"/>
    <path d="M12 12L20 22L28 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 22V30" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MASKS = {
    cpf: (value: string) => {
      return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    },
    phone: (value: string) => {
      return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    }
};

type ViewState = 'LOGIN' | 'REGISTER' | 'VERIFY_EMAIL' | 'FORGOT_PASSWORD';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Register Fields
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // State para tela de verificação
  const [unverifiedUser, setUnverifiedUser] = useState<FirebaseUser | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPhotoPreview(objectUrl);
    }
  };

  const getFirebaseErrorMessage = (errCode: string) => {
      switch(errCode) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password': 
            return 'Senha ou e-mail incorretos';
          case 'auth/email-already-in-use': 
            return 'O usuário já existe. Entrar?';
          case 'auth/weak-password': 
            return 'A senha deve ter pelo menos 6 caracteres.';
          case 'auth/invalid-email': 
            return 'E-mail inválido.';
          case 'auth/too-many-requests': 
            return 'Muitas tentativas. Tente mais tarde.';
          default: 
            return 'Senha ou e-mail incorretos';
      }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // VERIFICAÇÃO DE E-MAIL OBRIGATÓRIA
        if (!user.emailVerified) {
            setUnverifiedUser(user);
            setView('VERIFY_EMAIL');
            // IMPORTANTE: Não chamamos onLogin(user) aqui.
            // O usuário permanece "autenticado" no Firebase, mas bloqueado na UI
            // até que verifique e clique em "Fazer Login" novamente (ou refresh).
            return;
        }

        onLogin(user);
    } catch (err: any) {
        setError(getFirebaseErrorMessage(err.code));
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (password !== repeatPassword) {
          setError("As senhas não coincidem.");
          return;
      }

      if (!name || !cpf || !phone) {
          setError("Preencha todos os campos obrigatórios (Nome, CPF, Telefone).");
          return;
      }

      setIsLoading(true);

      try {
          // 1. Criar usuário no Auth
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 2. Upload da Foto (se houver)
          let photoUrl = '';
          if (photoFile) {
              try {
                photoUrl = await uploadUserPhoto(user.uid, photoFile);
              } catch (e) {
                console.warn("Falha no upload da foto inicial", e);
              }
          }

          // 3. Atualizar Profile do Auth (Nome e Foto)
          await updateProfile(user, {
              displayName: name,
              photoURL: photoUrl || null
          });

          // 4. Salvar dados extras no Firestore
          await createUserProfile(user, {
              cpf,
              phone,
              photoUrl
          });

          // 5. Enviar Email de Verificação
          await sendEmailVerification(user);

          // 6. Configurar UI para Verificação (Não loga automaticamente)
          setUnverifiedUser(user);
          setView('VERIFY_EMAIL');

      } catch (err: any) {
          setError(getFirebaseErrorMessage(err.code));
      } finally {
          setIsLoading(false);
      }
  };

  const handleResendVerification = async () => {
      if (unverifiedUser && resendCooldown === 0) {
          try {
              await sendEmailVerification(unverifiedUser);
              setSuccessMsg('E-mail reenviado com sucesso!');
              setResendCooldown(60);
              const interval = setInterval(() => {
                  setResendCooldown((prev) => {
                      if (prev <= 1) clearInterval(interval);
                      return prev - 1;
                  });
              }, 1000);
          } catch (error) {
              setError('Erro ao reenviar. Tente novamente em instantes.');
          }
      }
  };

  const handleLogoutAndReturn = async () => {
      await signOut(auth);
      setUnverifiedUser(null);
      setView('LOGIN');
      setError('');
      setSuccessMsg('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setIsLoading(true);

      if (!email) {
          setError("Digite seu e-mail.");
          setIsLoading(false);
          return;
      }

      try {
          await sendPasswordResetEmail(auth, email);
          setSuccessMsg(`Enviamos a você um link de alteração de senha para ${email}.`);
      } catch (err: any) {
          setError(getFirebaseErrorMessage(err.code));
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 font-sans selection:bg-slate-900 selection:text-white p-4">
      {/* Container Centralizado */}
      <div className="w-full max-w-[440px] bg-white p-8 lg:p-10 rounded-3xl shadow-lg border border-slate-100 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-70"></div>
        
        <div className="flex flex-col items-center justify-center mb-10">
           <div className="mb-4 transform hover:scale-105 transition-transform"><LogoY /></div>
           <span className="text-3xl font-bold text-slate-900 tracking-tight">Notify</span>
        </div>

        {/* TELA DE VERIFICAÇÃO DE EMAIL */}
        {view === 'VERIFY_EMAIL' && (
            <div className="text-center animate-fade-in">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                    <Mail size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Verifique seu e-mail</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Enviamos a você um e-mail de verificação para <strong className="text-slate-800 break-all">{unverifiedUser?.email || email}</strong>. 
                    <br/>Verifique e faça login.
                </p>

                {successMsg && (
                    <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-lg flex items-center justify-center">
                        <CheckCircle size={14} className="mr-2"/> {successMsg}
                    </div>
                )}
                
                <div className="space-y-3">
                    <button 
                        onClick={handleLogoutAndReturn}
                        className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center"
                    >
                        <LogIn size={18} className="mr-2"/> Fazer Login
                    </button>

                    <button 
                        onClick={handleResendVerification}
                        disabled={resendCooldown > 0}
                        className="w-full bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={`mr-2 ${resendCooldown > 0 ? 'animate-spin' : ''}`}/> 
                        {resendCooldown > 0 ? `Aguarde ${resendCooldown}s` : 'Reenviar E-mail'}
                    </button>
                </div>
            </div>
        )}

        {/* TELA DE ESQUECI MINHA SENHA */}
        {view === 'FORGOT_PASSWORD' && (
            <div className="animate-fade-in">
                <button onClick={() => setView('LOGIN')} className="text-slate-400 hover:text-slate-600 mb-6 flex items-center text-sm font-medium">
                    <ArrowLeft size={16} className="mr-1" /> Voltar
                </button>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Redefinir Senha</h3>
                <p className="text-slate-500 text-sm mb-6">Informe seu e-mail para receber o link de redefinição.</p>

                {successMsg ? (
                    <div className="p-4 bg-green-50 text-green-700 text-sm rounded-xl border border-green-200 mb-6 flex flex-col gap-3">
                        <div className="flex items-start">
                            <CheckCircle size={18} className="mr-2 mt-0.5 shrink-0" />
                            {successMsg}
                        </div>
                        <button onClick={() => setView('LOGIN')} className="bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition">
                            Faça login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                        {error && (
                          <div className="p-3 bg-red-50 text-red-600 text-sm flex items-start rounded-xl">
                              <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                              <span>{error}</span>
                          </div>
                        )}
                        <div className="relative group">
                            <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" 
                                placeholder="E-mail" 
                            />
                        </div>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 flex items-center justify-center disabled:opacity-70"
                        >
                           {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Obter link de redefinição'}
                        </button>
                    </form>
                )}
            </div>
        )}

        {/* TELA DE LOGIN / REGISTRO */}
        {(view === 'LOGIN' || view === 'REGISTER') && (
          <>
            <div className="flex justify-center space-x-1 mb-8 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60">
              <button 
                onClick={() => { setView('LOGIN'); setError(''); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${view === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Entrar
              </button>
              <button 
                onClick={() => { setView('REGISTER'); setError(''); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${view === 'REGISTER' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Cadastrar
              </button>
            </div>

            <form onSubmit={view === 'LOGIN' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm flex items-start rounded-xl border border-red-100">
                   <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                   <span>{error}</span>
                </div>
              )}

              {view === 'REGISTER' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Photo Upload */}
                  <div className="flex flex-col items-center mb-4">
                      <div 
                          className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-blue-400 transition"
                          onClick={() => fileInputRef.current?.click()}
                      >
                          {photoPreview ? (
                              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                              <Camera className="text-slate-400 group-hover:text-blue-500" size={28} />
                          )}
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">
                              ALTERAR
                          </div>
                      </div>
                      <span className="text-xs text-slate-400 mt-2">Foto de Perfil (Opcional)</span>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handlePhotoChange}
                      />
                  </div>

                  <div className="relative group">
                      <User className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" placeholder="Nome Completo" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                          <FileText className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                          <input 
                              type="text" 
                              value={cpf} 
                              maxLength={14}
                              onChange={(e) => setCpf(MASKS.cpf(e.target.value))} 
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" 
                              placeholder="CPF" 
                          />
                      </div>
                      <div className="relative group">
                          <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                          <input 
                              type="text" 
                              value={phone} 
                              maxLength={15}
                              onChange={(e) => setPhone(MASKS.phone(e.target.value))} 
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" 
                              placeholder="Telefone" 
                          />
                      </div>
                  </div>
                </div>
              )}

              <div className="relative group">
                <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" placeholder="E-mail" />
              </div>

              <div className="relative group">
                <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                <input 
                    type={showPassword ? "text" : "password"}
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" 
                    placeholder="Senha" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {view === 'REGISTER' && (
                <div className="relative group animate-fade-in">
                  <CheckCircle className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                  <input 
                      type={showRepeatPassword ? "text" : "password"} 
                      value={repeatPassword} 
                      onChange={(e) => setRepeatPassword(e.target.value)} 
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" 
                      placeholder="Confirme a senha" 
                  />
                </div>
              )}

              {view === 'LOGIN' && (
                  <div className="flex justify-end">
                      <button type="button" onClick={() => setView('FORGOT_PASSWORD')} className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                          Esqueceu a senha?
                      </button>
                  </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 flex items-center justify-center group relative overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
              >
                 {isLoading ? <Loader2 className="animate-spin" size={20} /> : (view === 'REGISTER' ? 'Criar Conta' : 'Entrar')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
