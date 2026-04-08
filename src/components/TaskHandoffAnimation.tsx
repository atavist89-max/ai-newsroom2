import { useEffect, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HandoffEvent {
  id: string;
  from: string;
  to: string;
  timestamp: number;
}

interface TaskHandoffAnimationProps {
  fromAgent: string | null;
  toAgent: string | null;
  className?: string;
}

export function TaskHandoffAnimation({ 
  fromAgent, 
  toAgent, 
  className 
}: TaskHandoffAnimationProps) {
  const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);

  useEffect(() => {
    if (fromAgent && toAgent && fromAgent !== toAgent) {
      const newHandoff: HandoffEvent = {
        id: `${fromAgent}-${toAgent}-${Date.now()}`,
        from: fromAgent,
        to: toAgent,
        timestamp: Date.now()
      };
      
      setHandoffs(prev => [...prev, newHandoff]);
      
      // Remove after animation completes
      setTimeout(() => {
        setHandoffs(prev => prev.filter(h => h.id !== newHandoff.id));
      }, 2000);
    }
  }, [fromAgent, toAgent]);

  if (handoffs.length === 0) return null;

  return (
    <div className={cn('fixed inset-0 pointer-events-none z-50', className)}>
      {handoffs.map((handoff) => (
        <HandoffEnvelope key={handoff.id} from={handoff.from} to={handoff.to} />
      ))}
    </div>
  );
}

function HandoffEnvelope({ from, to }: { from: string; to: string }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Find the DOM elements for from and to agents
    const fromEl = document.querySelector(`[data-agent="${from}"]`);
    const toEl = document.querySelector(`[data-agent="${to}"]`);

    if (fromEl && toEl) {
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      setPosition({
        x: fromRect.left + fromRect.width / 2,
        y: fromRect.top + fromRect.height / 2
      });

      setVisible(true);

      // Animate to target
      const animationDuration = 1500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        const currentX = fromRect.left + fromRect.width / 2 + 
          (toRect.left + toRect.width / 2 - fromRect.left - fromRect.width / 2) * easeOutQuart;
        const currentY = fromRect.top + fromRect.height / 2 + 
          (toRect.top + toRect.height / 2 - fromRect.top - fromRect.height / 2) * easeOutQuart;
        
        setPosition({ x: currentX, y: currentY });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [from, to]);

  if (!visible) return null;

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative">
        {/* Envelope */}
        <div className="w-10 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded shadow-lg animate-bounce">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-4 border-t-2 border-l-2 border-r-2 border-white/50 rounded-t" />
          </div>
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[10px] border-t-blue-400" />
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full animate-pulse" />
      </div>
    </div>
  );
}
