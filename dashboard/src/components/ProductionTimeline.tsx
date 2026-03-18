'use client'

import { useMemo, useState, useEffect, useRef } from 'react';
import { format, differenceInMinutes, isWithinInterval, addMinutes, eachHourOfInterval, min, max } from 'date-fns';
import { cn } from '@/lib/utils';
import { addDowntimeComment, updateDowntimeComment } from '@/app/actions';
import { X, Send, AlertCircle, MousePointer2, MessageSquareText, PencilLine, Plus, ListFilter } from 'lucide-react';

interface Props {
  lineId: string;
  initialPlans: any[];
  initialHistory: any[];
  initialComments: any[];
  from: string;
  to: string;
}

export function ProductionTimeline({ lineId, initialPlans, initialHistory, initialComments, from: fromStr, to: toStr }: Props) {
  const [mounted, setMounted] = useState(false);
  const from = useMemo(() => new Date(fromStr), [fromStr]);
  const to = useMemo(() => new Date(toStr), [toStr]);
  const totalMinutes = differenceInMinutes(to, from);
  const [now, setNow] = useState(new Date());
  
  // Mechanizm Click vs Drag
  const dragStartPos = useRef<{ x: number; y: number; date: Date; type: string; comments: any[] } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: Date; end: Date } | null>(null);
  
  const [modalData, setModalData] = useState<{ start: Date; end: Date; existingId?: string; } | null>(null);
  const [actionChoice, setActionChoice] = useState<{ start: Date; end: Date; comments: any[] } | null>(null);
  
  const [commentText, setCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getPosition = (date: Date) => {
    const diff = differenceInMinutes(new Date(date), from);
    return Math.max(0, Math.min(100, (diff / totalMinutes) * 100));
  };

  const hours = useMemo(() => {
    const allHours = eachHourOfInterval({ start: from, end: to });
    return allHours.filter((_, i) => i % 2 === 0);
  }, [from, to]);

  const planSegments = useMemo(() => {
    return initialPlans.map(plan => {
      const segments: { start: Date; end: Date; type: 'running' | 'downtime' }[] = [];
      const planStart = new Date(Math.max(new Date(plan.startTime).getTime(), from.getTime()));
      const planEnd = new Date(Math.min(new Date(plan.endTime).getTime(), to.getTime()));
      if (planStart >= planEnd) return { ...plan, segments: [] };
      let current = new Date(planStart);
      while (current < planEnd) {
        const next = addMinutes(current, 15);
        const segmentEnd = next > planEnd ? planEnd : next;
        const hasRunning = initialHistory.some(h => isWithinInterval(new Date(h.time), { start: current, end: segmentEnd }) && h.status === true);
        segments.push({ start: new Date(current), end: new Date(segmentEnd), type: hasRunning ? 'running' : 'downtime' });
        current = next;
      }
      return { ...plan, segments };
    });
  }, [initialPlans, initialHistory, from, to]);

  // OBSŁUGA INTELIGENTNEGO KLIKNIĘCIA
  const onMouseDown = (e: React.MouseEvent, date: Date, type: string, comments: any[]) => {
    if (type === 'running') return;
    dragStartPos.current = { x: e.clientX, y: e.clientY, date, type, comments };
  };

  const onMouseMove = (e: React.MouseEvent, date: Date) => {
    if (!dragStartPos.current) return;

    // Sprawdź czy przesunięto myszkę wystarczająco by uznać to za DRAG (prog 5px)
    const dist = Math.sqrt(Math.pow(e.clientX - dragStartPos.current.x, 2) + Math.pow(e.clientY - dragStartPos.current.y, 2));
    
    if (dist > 5) {
      setIsSelecting(true);
      setSelectionRange({
        start: min([dragStartPos.current.date, date]),
        end: max([dragStartPos.current.date, addMinutes(date, 15)])
      });
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!dragStartPos.current) return;

    if (!isSelecting) {
      // To był zwykły CLICK -> Menu akcji jeśli są komentarze
      if (dragStartPos.current.comments.length > 0) {
        setActionChoice({ 
          start: dragStartPos.current.date, 
          end: addMinutes(dragStartPos.current.date, 15), 
          comments: dragStartPos.current.comments 
        });
      } else {
        // Kliknięcie w puste -> otwórz nowy modal dla tego segmentu
        setModalData({ start: dragStartPos.current.date, end: addMinutes(dragStartPos.current.date, 15) });
        setCommentText('');
      }
    } else {
      // To był DRAG -> Otwórz modal dla całego zakresu
      if (selectionRange) {
        setModalData(selectionRange);
        setCommentText('');
      }
    }

    dragStartPos.current = null;
    setIsSelecting(false);
    setSelectionRange(null);
  };

  useEffect(() => {
    const upListener = () => { dragStartPos.current = null; setIsSelecting(false); setSelectionRange(null); };
    window.addEventListener('mouseup', upListener);
    return () => window.removeEventListener('mouseup', upListener);
  }, []);

  async function handleSaveComment() {
    if (!modalData || !commentText.trim()) return;
    setIsSaving(true);
    const result = modalData.existingId ? await updateDowntimeComment(modalData.existingId, commentText) : await addDowntimeComment({ lineId, startTime: modalData.start, endTime: modalData.end, comment: commentText });
    if (result.success) { setModalData(null); setCommentText(''); }
    setIsSaving(false);
  }

  if (!mounted) return <div className="min-h-[250px] bg-white animate-pulse" />;

  return (
    <div className="relative w-full bg-white pt-28 pb-10 px-8 overflow-x-visible min-h-[300px] select-none">
      <div className="relative h-1.5 w-full bg-slate-50 mb-12 z-0 rounded-full border border-slate-100">
        {hours.map((hour, i) => (
          <div key={i} className="absolute border-l-2 border-slate-200 h-4 top-[-2px]" style={{ left: `${getPosition(hour)}%` }}>
            <span className="absolute top-[-36px] left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400 whitespace-nowrap bg-white px-1.5 py-0.5 rounded border border-slate-100">{format(hour, 'HH:mm')}</span>
          </div>
        ))}
        {isWithinInterval(now, { start: from, end: to }) && (
          <div className="absolute top-[-60px] bottom-[-150px] w-0.5 bg-blue-500 z-[5]" style={{ left: `${getPosition(now)}%` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-600 text-[9px] font-black text-white rounded uppercase tracking-[0.2em] shadow-lg">Live</div>
          </div>
        )}
      </div>

      <div className="relative space-y-12 z-10">
        {planSegments.map((plan, pIdx) => {
          const planStartPos = getPosition(new Date(plan.startTime));
          const planWidth = getPosition(new Date(plan.endTime)) - planStartPos;
          const isOdd = pIdx % 2 === 0;
          const labelTop = isOdd ? "-top-8" : "-top-16";
          const connectorHeight = isOdd ? "h-8" : "h-16";

          return (
            <div key={plan.id} className="relative h-16 w-full">
              <div className="absolute h-full" style={{ left: `${planStartPos}%`, width: `${planWidth}%` }}>
                <div className={cn("absolute left-0 flex flex-col items-start pointer-events-none z-20", labelTop)}>
                  <div className="flex items-center gap-2 bg-slate-900 text-white px-2 py-1 rounded-md shadow-lg border border-slate-800"><span className="text-[10px] font-black uppercase tracking-widest">{plan.productIndex}</span><span className="text-[8px] text-slate-400 font-mono border-l border-slate-700 pl-2">{plan.plannedSpeed}</span></div>
                  <div className={cn("w-px bg-slate-200 ml-4", connectorHeight)}></div>
                </div>

                <div className="absolute inset-0 flex bg-slate-50/50 rounded-xl border border-slate-100 shadow-[inset_0_2px_10px_rgb(0,0,0,0.02)] overflow-visible z-10" onMouseUp={onMouseUp}>
                  {plan.segments.map((seg: any, idx: number) => {
                    const width = ((getPosition(seg.end) - getPosition(seg.start)) / planWidth) * 100;
                    const matchingComments = initialComments.filter(c => {
                      const cStart = new Date(c.startTime);
                      const cEnd = new Date(c.endTime);
                      return (cStart <= seg.start && cEnd >= seg.end) || (isWithinInterval(cStart, { start: seg.start, end: seg.end }));
                    });
                    const isBeingSelected = selectionRange && isWithinInterval(seg.start, { start: selectionRange.start, end: selectionRange.end });
                    const shouldShowDot = matchingComments.some(c => {
                      const midTime = new Date((new Date(c.startTime).getTime() + new Date(c.endTime).getTime()) / 2);
                      return isWithinInterval(midTime, { start: seg.start, end: seg.end });
                    });

                    return (
                      <div key={idx}
                        onMouseDown={(e) => onMouseDown(e, seg.start, seg.type, matchingComments)}
                        onMouseEnter={() => onMouseMove({ clientX: 0, clientY: 0 } as any, seg.start)} // Uproszczone dla logic
                        className={cn(
                          "h-full border-r border-white/5 last:border-0 relative transition-all group/seg",
                          seg.type === 'running' ? "bg-emerald-500" : "bg-rose-500 cursor-crosshair hover:brightness-110",
                          isBeingSelected && "ring-4 ring-blue-400 ring-inset z-[60] brightness-125",
                          shouldShowDot && "after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-2.5 after:h-2.5 after:bg-white after:rounded-full after:shadow-lg after:border-2 after:border-rose-500"
                        )}
                        style={{ width: `${width}%` }}
                        onMouseMove={(e) => onMouseMove(e, seg.start)}
                      >
                        {matchingComments.length > 0 && !isSelecting && (
                          <div className="absolute opacity-0 group-hover/seg:opacity-100 transition-opacity bottom-full left-0 z-[100] pb-4 pointer-events-none min-w-[280px]">
                            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-slate-800 space-y-3 text-left">
                              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-1"><div className="flex items-center gap-2"><MessageSquareText size={16} className="text-blue-400" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Analiza Przestoju</span></div><PencilLine size={14} className="text-slate-500" /></div>
                              {matchingComments.map((c, i) => <div key={i} className="space-y-1 border-b border-white/5 last:border-0 pb-2 last:pb-0 text-left"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{format(new Date(c.startTime), 'HH:mm')} - {format(new Date(c.endTime), 'HH:mm')}</p><p className="text-sm font-semibold italic text-slate-100">"{c.comment}"</p></div>)}
                            </div>
                            <div className="w-4 h-4 bg-slate-900 rotate-45 absolute bottom-2 left-6"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE AKCJI / EDYCJI / DODAWANIA (Logic unchanged) */}
      {actionChoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-left">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50"><div className="flex items-center gap-3"><div className="p-2 bg-slate-900 rounded-lg text-white"><MessageSquareText size={20} /></div><h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Akcje przestoju</h4></div><button onClick={() => setActionChoice(null)} className="text-slate-400 hover:text-slate-900 rounded-full"><X size={20} /></button></div>
            <div className="p-4 space-y-4">
              <button onClick={() => { setModalData({ start: actionChoice.start, end: actionChoice.end }); setCommentText(''); setActionChoice(null); }} className="w-full flex items-center gap-4 p-5 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-all group">
                <div className="p-2 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform"><Plus size={16} /></div>
                <div className="text-left"><p className="text-sm font-black text-blue-900 uppercase tracking-tighter">Dodaj nowy opis</p><p className="text-[10px] text-blue-600 font-bold uppercase opacity-70">Wpisz kolejny powód dla tego czasu</p></div>
              </button>
              <div className="h-px bg-slate-100 mx-4"></div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Edytuj istniejące:</p>
                {actionChoice.comments.map((c: any) => (<button key={c.id} onClick={() => { setModalData({ start: new Date(c.startTime), end: new Date(c.endTime), existingId: c.id }); setCommentText(c.comment); setActionChoice(null); }} className="w-full text-left p-4 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 transition-all flex justify-between items-center group"><div className="overflow-hidden text-left"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{format(new Date(c.startTime), 'HH:mm')} - {format(new Date(c.endTime), 'HH:mm')}</p><p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 truncate">"{c.comment}"</p></div><PencilLine size={14} className="text-slate-300 group-hover:text-blue-400 shrink-0 ml-4" /></button>))}
              </div>
            </div>
          </div>
        </div>
      )}

      {modalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-left">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50"><div className="flex items-center gap-3 text-left"><div className={cn("p-2 rounded-lg", modalData.existingId ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600")}><AlertCircle size={20} /></div><div className="text-left"><h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">{modalData.existingId ? 'Edycja Opisu' : 'Nowy Opis Przestoju'}</h4><p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Zakres: {format(modalData.start, 'HH:mm')} - {format(modalData.end, 'HH:mm')}</p></div></div><button onClick={() => setModalData(null)} className="text-slate-400 hover:text-slate-900 rounded-full"><X size={20} /></button></div>
            <div className="p-8 space-y-6"><textarea autoFocus placeholder="Opisz przyczynę..." className="w-full h-40 bg-white border-2 border-slate-100 rounded-2xl p-5 text-base text-slate-900 focus:border-blue-500 outline-none transition-all resize-none font-medium text-left" value={commentText} onChange={(e) => setCommentText(e.target.value)} /><button disabled={isSaving || !commentText.trim()} onClick={handleSaveComment} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-[0.2em] py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-slate-900/20">{isSaving ? 'Zapisywanie...' : <><Send size={16} /> {modalData.existingId ? 'Zaktualizuj wpis' : 'Zatwierdź opis'}</>}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
