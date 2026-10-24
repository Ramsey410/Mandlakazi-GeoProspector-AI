
import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Loader2, Bot, User } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '../services/geminiService';

interface ChatAssistantProps {
  initialContext?: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ initialContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: "Hello! I'm your GeoAI Assistant. I have access to multispectral data and regional geological records. How can I help with your exploration today?",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      const historyForApi = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const imageBase64 = userMsg.image ? userMsg.image.split(',')[1] : undefined;
      const responseText = await sendChatMessage(historyForApi, userMsg.text, imageBase64);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "System sync error. Please check your connection or API status.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/20 rounded-2xl overflow-hidden relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-slate-800 border border-white/5' : 'bg-gradient-to-br from-amber-500 to-amber-600 border border-amber-400/50'}`}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-slate-400" /> : <Bot className="w-5 h-5 text-slate-900" />}
            </div>

            <div className={`max-w-[75%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.image && (
                <div className="relative group">
                  <img src={msg.image} alt="Upload" className="max-w-full h-48 object-cover rounded-2xl border border-white/10 shadow-2xl transition-transform group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] rounded-tr-none'
                  : 'bg-slate-900/80 text-slate-200 border border-white/5 backdrop-blur-sm rounded-tl-none shadow-xl'
                }`}>
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-0 prose-headings:text-white prose-a:text-amber-400">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest text-slate-600 block px-2`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce [animation-delay:200ms]"></span>
                <span className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce [animation-delay:400ms]"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (Floating) */}
      <div className="absolute bottom-6 left-6 right-6 z-20">
        <div className="glass-panel p-2 rounded-2xl border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {selectedImage && (
            <div className="mx-2 mb-2 mt-1 flex items-center justify-between bg-slate-900/80 p-2 rounded-xl border border-white/5 animate-fade-in">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                  <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Image Loaded</span>
              </div>
              <button onClick={() => setSelectedImage(null)} className="text-slate-500 hover:text-white p-1">&times;</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl cursor-pointer transition-all active:scale-95 shrink-0">
              <ImageIcon className="w-5 h-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Analyze core samples or regional trends..."
              className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-slate-600 px-2"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() && !selectedImage}
              className="p-3 bg-white text-slate-900 rounded-xl disabled:opacity-20 disabled:grayscale transition-all hover:bg-amber-400 hover:scale-105 active:scale-95 shadow-lg shrink-0"
            >
              <Send className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
