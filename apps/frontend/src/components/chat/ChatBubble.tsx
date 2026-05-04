import { cn } from '../ui/cn';
import { Icon } from '../ui/Icon';

interface ChatBubbleProps {
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  time: string;
  type?: string;
  isNote?: boolean;
  authorName?: string;
  onDeleteNote?: () => void;
}

export function ChatBubble({
  content,
  direction,
  time,
  type = 'TEXT',
  isNote = false,
  authorName,
  onDeleteNote,
}: ChatBubbleProps) {
  if (isNote) {
    return (
      <div className="flex justify-center my-4 animate-in">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-[80%] shadow-sm relative group">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="history" size="xs" className="text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Nota Interna · {authorName}
            </span>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed">{content}</p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-amber-600/70 font-medium">{time}</span>
            {onDeleteNote && (
              <button
                onClick={onDeleteNote}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-amber-200/50 rounded text-amber-700"
              >
                <Icon name="delete" size="xs" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isOutbound = direction === 'OUTBOUND';

  return (
    <div className={cn(
      "flex w-full mb-4 animate-in",
      isOutbound ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 shadow-sm relative group transition-all duration-300 hover:shadow-md",
        isOutbound 
          ? "bg-primary text-primary-foreground rounded-tr-none" 
          : "bg-white border border-border text-foreground rounded-tl-none"
      )}>
        {type === 'IMAGE' ? (
          <div className="mb-2 rounded-lg overflow-hidden">
             <img src={content} alt="Media" className="max-w-full h-auto" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        )}
        
        <div className={cn(
          "flex items-center gap-1.5 mt-1.5",
          isOutbound ? "justify-end" : "justify-start"
        )}>
          <span className={cn(
            "text-[10px] font-medium",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {time}
          </span>
          {isOutbound && (
            <Icon name="check_circle" size="xs" className="text-primary-foreground/50" />
          )}
        </div>

        {/* Bubble Tail Replacement (Stylized) */}
        <div className={cn(
          "absolute top-0 w-2 h-2",
          isOutbound 
            ? "-right-1 bg-primary clip-path-tail-right" 
            : "-left-1 bg-white border-l border-t border-border clip-path-tail-left"
        )} />
      </div>
    </div>
  );
}
