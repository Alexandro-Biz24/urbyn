import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, User, Headset, Circle } from 'lucide-react';
import { cn } from './ui/utils';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Bonjour ! Bienvenue chez Urbyn. Comment pouvons-nous vous aider aujourd'hui ?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Mock bot reply
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Merci pour votre message. Un conseiller technique Urbyn va vous répondre dans quelques instants. Pour une demande urgente, n'hésitez pas à nous appeler au 01 80 87 77 80.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 right-0 w-[min(380px,calc(100vw-3rem))] h-[min(520px,70vh)] bg-white rounded-2xl shadow-2xl border border-black flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-black p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-black">
                    <Headset className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Assistance Urbyn</h3>
                    <div className="flex items-center gap-1.5">
                      <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-white uppercase font-black tracking-widest">En ligne</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Area */}
              <div 
                ref={scrollRef}
                className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4"
              >
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      msg.sender === 'user' ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm font-medium shadow-sm",
                      msg.sender === 'user'
                        ? "bg-black text-white rounded-tr-none"
                        : "bg-white text-black border border-black rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-black mt-1 font-bold">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex items-center gap-1 text-black">
                    <div className="flex gap-1 bg-white border border-black p-2 rounded-xl rounded-tl-none">
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
                        className="w-1.5 h-1.5 bg-black rounded-full"
                      />
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                        className="w-1.5 h-1.5 bg-black rounded-full"
                      />
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                        className="w-1.5 h-1.5 bg-black rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <form 
                onSubmit={handleSendMessage}
                className="p-4 bg-white border-t border-slate-100 flex gap-2"
              >
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Tapez votre message..."
                  className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-black focus:ring-2 focus:ring-black transition-all outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="w-10 h-10 bg-black hover:bg-gray-800 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Bubble */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 group",
            isOpen ? "bg-white text-black border-2 border-black" : "bg-black text-white"
          )}
        >
          {isOpen ? (
            <X className="w-8 h-8" />
          ) : (
            <div className="relative">
              <MessageSquare className="w-8 h-8" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black animate-pulse" />
            </div>
          )}

          {!isOpen && (
            <div className="absolute right-20 bg-white border border-black px-4 py-2 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <p className="text-xs font-black text-black uppercase tracking-tight">Besoin d'aide ?</p>
              <p className="text-[10px] text-black font-bold uppercase">Discutez avec un expert</p>
              {/* Arrow */}
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-black rotate-45" />
            </div>
          )}
        </button>
      </div>
    </>
  );
}
