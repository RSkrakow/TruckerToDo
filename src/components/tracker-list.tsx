'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUpRight} from 'lucide-react';
import type {Item,Area,Profile} from '@/lib/types';
import {updateItem} from '@/app/actions';
import {date,statusNames,cn} from '@/lib/utils';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/fields';

interface TrackerListProps {
  items: Item[];
  areas: Area[];
  people: Profile[];
  profile: Profile;
  memberships: {area_id: string; user_id: string}[];
  today: string;
}

export function TrackerList({items,areas,people,profile,memberships,today}: TrackerListProps) {
  const router = useRouter();
  const [list, setList] = useState<Item[]>(items);
  const [activePopup, setActivePopup] = useState<{itemId: string; mode: 'preview' | 'edit'; placement: 'bottom' | 'top'} | null>(null);
  const [draftDesc, setDraftDesc] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setList(items);
  }, [items]);

  // Save current filter URL and handle returning from full edit
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const shouldRestore = sessionStorage.getItem('tracker_from_full_edit');
        const savedSearch = sessionStorage.getItem('tracker_last_search');

        if (shouldRestore === 'true') {
          sessionStorage.removeItem('tracker_from_full_edit');
          if (savedSearch && !window.location.search) {
            router.replace('/' + savedSearch);
            return;
          }
        }

        // Always save current full URL and search parameters when on tracker
        sessionStorage.setItem('tracker_last_url', window.location.pathname + window.location.search);
        if (window.location.search) {
          sessionStorage.setItem('tracker_last_search', window.location.search);
        }
      }
    } catch {}
  }, [router]);

  // Restore scroll position after returning from full edit or navigation
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('tracker_scroll_pos');
      if (saved !== null) {
        sessionStorage.removeItem('tracker_scroll_pos');
        const pos = parseInt(saved, 10);
        if (!isNaN(pos)) {
          requestAnimationFrame(() => {
            window.scrollTo({top: pos, behavior: 'instant'});
          });
        }
      }
    } catch {}
  }, []);

  const canEditItem = useCallback((item: Item) => {
    if (profile.role === 'admin') return true;
    if (profile.role === 'manager') {
      return memberships.some(m => m.area_id === item.area_id && m.user_id === profile.id);
    }
    return false;
  }, [profile, memberships]);

  const activeItem = activePopup ? list.find(i => i.id === activePopup.itemId) : null;
  const hasChanges = activeItem ? draftDesc !== (activeItem.description || '') : false;

  const calculatePlacement = useCallback((itemId: string): 'bottom' | 'top' => {
    const rowEl = rowRefs.current[itemId];
    if (!rowEl) return 'bottom';
    const rect = rowEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      return 'top';
    }
    return 'bottom';
  }, []);

  const handleRowMouseEnter = (item: Item) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    // If currently editing an item (locked), do not switch on hover
    if (activePopup?.mode === 'edit') return;

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    hoverTimerRef.current = setTimeout(() => {
      const placement = calculatePlacement(item.id);
      setActivePopup({itemId: item.id, mode: 'preview', placement});
      setDraftDesc(item.description || '');
      setError(null);
    }, 300);
  };

  const handleRowMouseLeave = (item: Item) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (activePopup?.itemId === item.id && activePopup.mode === 'preview') {
      leaveTimerRef.current = setTimeout(() => {
        setActivePopup(null);
      }, 150);
    }
  };

  const handlePopupMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const handlePopupMouseLeave = () => {
    if (activePopup?.mode === 'preview') {
      leaveTimerRef.current = setTimeout(() => {
        setActivePopup(null);
      }, 150);
    }
  };

  const handleRowClick = (item: Item, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If an item is already being edited with unsaved changes, protect it
    if (activePopup?.mode === 'edit' && activePopup.itemId !== item.id && hasChanges) {
      const discard = window.confirm('Masz niezapisane zmiany w edytowanym zadaniu. Czy chcesz je odrzucić?');
      if (!discard) return;
    }

    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);

    const placement = calculatePlacement(item.id);
    setActivePopup({itemId: item.id, mode: 'edit', placement});
    setDraftDesc(item.description || '');
    setError(null);
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setActivePopup(null);
    setDraftDesc('');
    setError(null);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeItem) return;
    if (!canEditItem(activeItem)) {
      setError('Brak uprawnień do edycji tego zadania.');
      return;
    }
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    setError(null);

    const input = {
      title: activeItem.title,
      description: draftDesc,
      type: activeItem.type,
      area_id: activeItem.area_id,
      assigned_to: activeItem.assigned_to,
      due_date: activeItem.due_date,
      status: activeItem.status
    };

    const result = await updateItem(activeItem.id, input);
    if (result.error) {
      setError(result.error);
      setIsSaving(false);
    } else {
      setList(prev => prev.map(it => it.id === activeItem.id ? {...it, description: draftDesc} : it));
      setIsSaving(false);
      setActivePopup(null);
      setDraftDesc('');
    }
  };

  const handleFullEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeItem) return;

    if (hasChanges) {
      const proceed = window.confirm('Masz niezapisane zmiany w opisie. Czy na pewno chcesz przejść do pełnej edycji bez zapisywania?');
      if (!proceed) return;
    }

    try {
      sessionStorage.setItem('tracker_scroll_pos', String(window.scrollY));
      sessionStorage.setItem('tracker_last_url', window.location.pathname + window.location.search);
      if (window.location.search) {
        sessionStorage.setItem('tracker_last_search', window.location.search);
      }
      sessionStorage.setItem('tracker_from_full_edit', 'true');
    } catch {}

    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    router.push(`/items/${activeItem.id}?from=${returnUrl}`);
  };

  // Close popup on outside click when not locked in edit or when no unsaved changes
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!activePopup) return;
      const target = e.target as Node;
      if (popupRef.current && popupRef.current.contains(target)) return;
      const activeRowEl = rowRefs.current[activePopup.itemId];
      if (activeRowEl && activeRowEl.contains(target)) return;

      if (activePopup.mode === 'edit' && hasChanges) {
        // Do not close accidentally if changes are pending
        return;
      }
      setActivePopup(null);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activePopup) {
        if (activePopup.mode === 'edit' && hasChanges) {
          const discard = window.confirm('Odrzucić niezapisane zmiany w opisie?');
          if (!discard) return;
        }
        setActivePopup(null);
      }
    }

    document.addEventListener('pointerdown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activePopup, hasChanges]);

  return (
    <div className="grid gap-1.5">
      {list.map(item => {
        const area = areas.find(a => a.id === item.area_id);
        const person = people.find(u => u.id === item.assigned_to);
        const overdue = item.due_date && item.due_date < today && ['todo', 'in_progress'].includes(item.status);
        const isCurrentActive = activePopup?.itemId === item.id;
        const canEdit = canEditItem(item);

        return (
          <div
            key={item.id}
            ref={el => { rowRefs.current[item.id] = el; }}
            className="relative"
            onMouseEnter={() => handleRowMouseEnter(item)}
            onMouseLeave={() => handleRowMouseLeave(item)}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={e => handleRowClick(item, e)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(item, e as unknown as React.MouseEvent);
                }
              }}
              className={cn(
                "group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-lg border border-border bg-card px-3.5 py-2 shadow-xs transition-colors cursor-pointer select-none",
                "hover:border-primary/80 hover:bg-accent/40",
                isCurrentActive && "border-primary bg-accent/40 ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      borderColor: area?.color_code ? `${area.color_code}40` : undefined,
                      color: area?.color_code || 'inherit',
                      backgroundColor: area?.color_code ? `${area.color_code}10` : undefined
                    }}
                  >
                    {area?.name || 'Zadanie'}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                      item.status === 'done'
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {statusNames[item.status]}
                  </span>
                </div>
                <h2 className="text-sm font-semibold truncate group-hover:text-primary min-w-0" title={item.title}>
                  {item.title}
                </h2>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 text-xs text-muted-foreground pl-1 sm:pl-0">
                <span className="truncate max-w-[130px] sm:max-w-[170px]" title={person?.full_name || person?.email || 'Nie przypisano'}>
                  {person?.full_name || person?.email || (item.assigned_to ? 'Przypisana osoba' : 'Nie przypisano')}
                </span>
                <span className={cn("shrink-0", overdue && "font-semibold text-destructive")} title="Termin wykonania">
                  {item.due_date ? date(item.due_date) : '—'}{overdue ? ' · po terminie' : ''}
                </span>
                <ArrowUpRight size={15} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors"/>
              </div>
            </div>

            {isCurrentActive && (
              <div
                ref={popupRef}
                onMouseEnter={handlePopupMouseEnter}
                onMouseLeave={handlePopupMouseLeave}
                onClick={e => {
                  e.stopPropagation();
                  if (activePopup.mode === 'preview') {
                    setActivePopup(prev => prev ? {...prev, mode: 'edit'} : null);
                  }
                }}
                className={cn(
                  "absolute left-0 sm:left-2 z-50 w-full sm:w-[760px] lg:w-[820px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xl transition-all",
                  activePopup.placement === 'top'
                    ? "bottom-[calc(100%+6px)] after:absolute after:-bottom-2 after:left-0 after:right-0 after:h-2"
                    : "top-[calc(100%+6px)] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2"
                )}
                role="dialog"
                aria-modal={activePopup.mode === 'edit'}
                aria-label={item.title}
              >
                {/* 1. Nazwa */}
                <h3 className="text-sm sm:text-base font-semibold leading-snug break-words text-card-foreground select-text">
                  {item.title}
                </h3>

                {/* 2. Opis */}
                {activePopup.mode === 'preview' ? (
                  <div
                    className="mt-2.5 max-h-[280px] overflow-y-auto text-xs sm:text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words select-text cursor-text"
                    onClick={() => {
                      setActivePopup(prev => prev ? {...prev, mode: 'edit'} : null);
                    }}
                    title="Kliknij, aby edytować opis"
                  >
                    {item.description?.trim() ? (
                      item.description
                    ) : (
                      <span className="italic text-muted-foreground/60">Brak opisu (kliknij, aby dodać)</span>
                    )}
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <Textarea
                      value={draftDesc}
                      onChange={e => setDraftDesc(e.target.value)}
                      disabled={!canEdit || isSaving}
                      placeholder={canEdit ? "Wprowadź opis zadania…" : "Brak opisu"}
                      className="min-h-[140px] max-h-[340px] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap w-full"
                      autoFocus
                    />
                    {!canEdit && (
                      <p className="mt-1.5 text-xs text-muted-foreground">Tylko osoby zarządzające obszarem mogą edytować opis.</p>
                    )}
                    {error && (
                      <p role="alert" className="mt-1.5 text-xs text-destructive">{error}</p>
                    )}
                  </div>
                )}

                {/* 3. Przyciski: Anuluj, Edycja, Zapisz */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Anuluj
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFullEdit}
                      disabled={isSaving}
                    >
                      Edycja
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving || !canEdit}
                    >
                      {isSaving ? 'Zapisywanie…' : 'Zapisz'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
