import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, Download, Loader2, BrainCircuit, MessageSquareText } from 'lucide-react';
import { uploadUserFile, getUserFiles, deleteUserFile, updateFileMetadata } from '../services/userService';
import { FileItem } from '../types';
import { GoogleGenAI } from "@google/genai";

const FileManager: React.FC = () => {
  const savedUser = localStorage.getItem('mock_session_user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  
  // AI State
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [user]);

  const fetchFiles = async () => {
    if (user) {
      setLoading(true);
      const userFiles = await getUserFiles(user.uid);
      setFiles(userFiles);
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || !e.target.files[0]) return;
    
    setUploading(true);
    const file = e.target.files[0];
    
    try {
      const newFile = await uploadUserFile(user.uid, file, notes);
      setFiles([newFile, ...files]);
      setNotes(''); // reset notes
    } catch (error) {
      console.error("Upload failed", error);
      alert("Erro ao fazer upload do arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!user || !window.confirm(`Excluir ${file.name}?`)) return;
    
    try {
      setFiles(files.filter(f => f.id !== file.id)); // Optimistic UI
      await deleteUserFile(user.uid, file.id, file.storagePath);
    } catch (error) {
      console.error("Delete failed", error);
      fetchFiles(); // Revert on error
    }
  };

  const handleGenerateSummary = async (file: FileItem) => {
    if(!user) return;
    setGeneratingSummaryId(file.id);

    try {
        const apiKey = process.env.API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Analise os metadados deste arquivo e crie um resumo executivo jurídico curto.
        Nome do arquivo: ${file.name}
        Tipo: ${file.type}
        Notas do usuário: ${file.userNotes || "Sem notas"}
        
        Gere um resumo presumindo o conteúdo com base no nome e notas.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const summary = response.text || "Não foi possível gerar resumo.";

        await updateFileMetadata(user.uid, file.id, { aiSummary: summary });
        setFiles(files.map(f => f.id === file.id ? { ...f, aiSummary: summary } : f));

    } catch (error) {
        console.error("AI Summary failed", error);
        alert("Erro ao gerar resumo com IA.");
    } finally {
        setGeneratingSummaryId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
             <FileText className="mr-2 text-blue-600" />
             Gestão de Arquivos
          </h2>
          <p className="text-slate-500">Armazenamento local (Demo Mode).</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <input 
                    type="text" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Notas para o próximo arquivo..."
                    className="pl-3 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
            <label className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center transition shadow-md ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Upload className="mr-2" size={18} />}
                {uploading ? 'Enviando...' : 'Novo Upload'}
                <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="text-slate-400" size={24} />
            </div>
            <h3 className="text-lg font-medium text-slate-700">Nenhum arquivo encontrado</h3>
            <p className="text-slate-500 text-sm mt-1">Faça upload de documentos, PDFs ou imagens para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
            {files.map((file) => (
                <div key={file.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all flex flex-col md:flex-row gap-5">
                    
                    {/* Icon & Basic Info */}
                    <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-800 line-clamp-1 break-all">{file.name}</h4>
                            <div className="flex items-center text-xs text-slate-500 mt-1 gap-3">
                                <span className="uppercase bg-slate-100 px-1.5 py-0.5 rounded">{file.type.split('/')[1] || 'FILE'}</span>
                                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                            </div>
                            {file.userNotes && (
                                <div className="mt-2 text-sm text-slate-600 flex items-start bg-slate-50 p-2 rounded-lg">
                                    <MessageSquareText size={14} className="mr-2 mt-0.5 flex-shrink-0 text-slate-400" />
                                    {file.userNotes}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Summary Section */}
                    <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5 pt-3 md:pt-0">
                        <h5 className="text-xs font-bold text-purple-600 uppercase flex items-center mb-2">
                            <BrainCircuit size={14} className="mr-1" /> Análise IA
                        </h5>
                        {file.aiSummary ? (
                            <p className="text-sm text-slate-600 leading-relaxed bg-purple-50 p-3 rounded-lg border border-purple-100">
                                {file.aiSummary}
                            </p>
                        ) : (
                            <div className="text-sm text-slate-400 italic">
                                <p className="mb-2">Nenhum resumo gerado.</p>
                                <button 
                                    onClick={() => handleGenerateSummary(file)}
                                    disabled={generatingSummaryId === file.id}
                                    className="text-purple-600 hover:text-purple-800 text-xs font-medium flex items-center disabled:opacity-50"
                                >
                                    {generatingSummaryId === file.id ? <Loader2 className="animate-spin mr-1" size={12} /> : <BrainCircuit size={12} className="mr-1" />}
                                    Gerar Agora
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                        <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                        >
                            <Download size={16} className="mr-2" /> Baixar
                        </a>
                        <button 
                            onClick={() => handleDelete(file)}
                            className="flex items-center justify-center px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-sm font-medium transition"
                        >
                            <Trash2 size={16} className="mr-2" /> Excluir
                        </button>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default FileManager;