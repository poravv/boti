import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { cn } from '../ui/cn';

interface ChatInputProps {
  onSendMessage: (msg: string) => void;
  onSendNote: (note: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, onSendNote, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'MSG' | 'NOTE'>('MSG');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    if (mode === 'MSG') {
      onSendMessage(text.trim());
    } else {
      onSendNote(text.trim());
    }
    setText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="p-4 bg-white border-t border-border">
      {/* Mode Switcher */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('MSG')}
          className={cn(
            "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
            mode === 'MSG' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Mensaje
        </button>
        <button
          onClick={() => setMode('NOTE')}
          className={cn(
            "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
            mode === 'NOTE' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Nota Interna
        </button>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1 relative group">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'MSG' ? "Escribe un mensaje..." : "Escribe una nota interna para el equipo..."}
            disabled={disabled}
            className={cn(
              "w-full resize-none bg-muted/40 border border-transparent rounded-xl px-4 py-3 text-sm transition-all outline-none min-h-[48px] max-h-[150px] custom-scrollbar",
              "focus:bg-white focus:border-primary/20 focus:ring-4",
              mode === 'MSG' ? "focus:ring-primary/5" : "focus:ring-amber-500/5 focus:border-amber-500/20"
            )}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-1">
             <Button variant="ghost" size="sm" className="p-2 h-8 w-8 text-muted-foreground hover:text-primary">
               <Icon name="attach_file" size="sm" />
             </Button>
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-premium shrink-0",
            text.trim() 
              ? (mode === 'MSG' ? "bg-primary text-primary-foreground hover:shadow-lg hover:-translate-y-0.5" : "bg-amber-500 text-white hover:shadow-lg hover:-translate-y-0.5")
              : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
          )}
        >
          <Icon name="send" size="md" />
        </button>
      </div>
      
      <p className="mt-2 text-[10px] text-muted-foreground/60 font-medium text-center">
        Presiona <span className="font-bold">Enter</span> para enviar · <span className="font-bold">Shift + Enter</span> para nueva línea
      </p>
    </div>
  );
}
