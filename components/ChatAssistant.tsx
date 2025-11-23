
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
      text: "Hello! I'm your GeoAI Assistant. Upload a rock sample photo or ask me about the regional geology.",
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
      // Prepare history for context
      // We strip images from history for simplicity in this demo, or keep them if needed
      const historyForApi = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      // If there's initial context (like current report), append it implicitly to the first system/user prompt logic
      // For now, we just rely on the chat flow.

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
        text: "Sorry, I encountered an error processing your request.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 p-3 border-b border-slate-700 flex items-center gap-2">
        <Bot className="w-5 h-5 text-cyan-400" />
        <span className="font-bold text-slate-200">GeoAI Assistant</span>
        <span className="text-xs text-slate-500 ml-auto">Powered by Gemini 3 Pro</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-cyan-900/50 border border-cyan-800'}`}>
               {msg.role === 'user' ? <User className="w-4 h-4 text-slate-300" /> : <Bot className="w-4 h-4 text-cyan-400" />}
            </div>
            
            <div className={`max-w-[80%] space-y-2`}>
                {msg.image && (
                    <img src={msg.image} alt="Upload" className="max-w-full h-40 object-cover rounded border border-slate-700" />
                )}
                <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
                <span className="text-[10px] text-slate-600 block px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
            </div>
          </div>
        ))}
        {isTyping && (
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-900/50 border border-cyan-800 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                </div>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-800 border-t border-slate-700">
        {selectedImage && (
            <div className="mb-2 flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 w-fit">
                <span className="text-xs text-cyan-400">Image attached</span>
                <button onClick={() => setSelectedImage(null)} className="text-slate-500 hover:text-white">&times;</button>
            </div>
        )}
        <div className="flex gap-2">
            <label className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded cursor-pointer transition-colors">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about geology or upload a rock photo..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() && !selectedImage}
                className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
