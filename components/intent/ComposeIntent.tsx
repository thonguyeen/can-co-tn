'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ImagePlus, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MockIntent } from '@/lib/mock/intents';

interface ComposeIntentProps {
  /** Demo mode: adds to local mock list. Real mode: calls API. */
  mode?: 'demo' | 'real';
  onSubmit?: (intent: MockIntent) => void;
  onIntentCreated?: () => void;
}

const PLACEHOLDERS = {
  CAN: 'Mô tả thứ bạn đang tìm kiếm...\n\nVí dụ: Cần mua căn hộ 2PN quận 7 gần trường quốc tế, budget 3-4 tỷ',
  CO: 'Mô tả thứ bạn đang bán / cho thuê / cung cấp...\n\nVí dụ: Bán căn hộ Vinhomes Q7, 2PN 75m², full nội thất, 3.5 tỷ',
};

const DEMO_TAGS: Record<string, { icon: string; label: string }[]> = {
  'căn hộ 2pn quận 7': [
    { icon: '📍', label: 'Quận 7' },
    { icon: '🛏', label: '2 PN' },
    { icon: '🏠', label: 'Căn hộ' },
  ],
  'nhà phố gò vấp': [
    { icon: '📍', label: 'Gò Vấp' },
    { icon: '🏠', label: 'Nhà phố' },
  ],
  '3 tỷ': [{ icon: '💰', label: '~3 tỷ' }],
  '3-4 tỷ': [{ icon: '💰', label: '3-4 tỷ' }],
};

function extractDemoTags(text: string): { icon: string; label: string }[] {
  const lower = text.toLowerCase();
  const tags: { icon: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const [pattern, patternTags] of Object.entries(DEMO_TAGS)) {
    if (lower.includes(pattern)) {
      for (const tag of patternTags) {
        if (!seen.has(tag.label)) {
          tags.push(tag);
          seen.add(tag.label);
        }
      }
    }
  }

  const districts = ['quận 1', 'quận 3', 'quận 7', 'bình thạnh', 'thủ đức', 'gò vấp', 'tân bình', 'phú nhuận'];
  for (const d of districts) {
    if (lower.includes(d) && !seen.has(d)) {
      tags.push({ icon: '📍', label: d.charAt(0).toUpperCase() + d.slice(1) });
      seen.add(d);
    }
  }

  const pnMatch = lower.match(/(\d)\s*(?:pn|phòng ngủ)/);
  if (pnMatch && !seen.has('pn')) {
    tags.push({ icon: '🛏', label: `${pnMatch[1]} PN` });
    seen.add('pn');
  }

  return tags;
}

export function ComposeIntent({ mode = 'demo', onSubmit, onIntentCreated }: ComposeIntentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [type, setType] = useState<'CAN' | 'CO'>('CAN');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [tags, setTags] = useState<{ icon: string; label: string }[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const parseWithAI = useCallback(async (value: string) => {
    if (value.length < 15) return;
    setIsParsing(true);
    try {
      const res = await fetch('/api/intents/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: value }),
      });
      const data = await res.json();
      if (data.tags && data.tags.length > 0) {
        setTags(data.tags);
        setShowTags(true);
      } else {
        setShowTags(false);
      }
    } catch {
      // Fail silently
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleTextChange = useCallback((value: string) => {
    setText(value);

    if (mode === 'demo') {
      if (value.length > 15) {
        const extracted = extractDemoTags(value);
        setTags(extracted);
        setShowTags(extracted.length > 0);
      } else {
        setShowTags(false);
        setTags([]);
      }
    } else {
      // Real mode: debounced AI parsing
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      if (value.length >= 15) {
        parseTimerRef.current = setTimeout(() => parseWithAI(value), 2000);
      } else {
        setShowTags(false);
        setTags([]);
      }
    }
  }, [mode, parseWithAI]);

  const handleSubmitDemo = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));

    const newIntent: MockIntent = {
      id: `i-new-${Date.now()}`,
      user_id: 'demo-user',
      type,
      raw_text: text,
      title: text.slice(0, 80),
      parsed_data: {},
      category: 'real_estate',
      subcategory: 'apartment',
      price: null, price_min: null, price_max: null,
      address: null, district: null, ward: null,
      city: 'Hồ Chí Minh', lat: null, lng: null,
      trust_score: 1, verification_level: 'none',
      comment_count: 0, match_count: 0, view_count: 0,
      status: 'active', expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: { id: 'demo-user', name: 'Bạn', avatar_url: null, trust_score: 1, verification_level: 'none' },
      images: [], bot_comment: null, latest_comment: null,
    };

    onSubmit?.(newIntent);
    resetForm();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(
      (f) => f.size <= 5 * 1024 * 1024 && /\.(jpe?g|png|webp)$/i.test(f.name),
    ).slice(0, 10 - selectedImages.length);

    setSelectedImages((prev) => [...prev, ...validFiles]);
    const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReal = async () => {
    setIsSubmitting(true);
    try {
      // 1. Create intent
      const res = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, raw_text: text, category: 'real_estate' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      const intent = await res.json();

      // 2. Upload images if any (CÓ only)
      if (selectedImages.length > 0 && type === 'CO' && intent.id) {
        const formData = new FormData();
        selectedImages.forEach((f) => formData.append('images', f));

        await fetch(`/api/intents/${intent.id}/images`, {
          method: 'POST',
          body: formData,
        }).catch(() => {
          // Images failed but intent created — acceptable
        });
      }

      setToast({ type: 'success', message: 'Đã đăng thành công!' });
      onIntentCreated?.();
      resetForm();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Không thể đăng, vui lòng thử lại' });
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (text.trim().length < 10) return;
    if (mode === 'demo') {
      handleSubmitDemo();
    } else {
      handleSubmitReal();
    }
  };

  const resetForm = () => {
    setText('');
    setTags([]);
    setShowTags(false);
    setIsExpanded(false);
    setIsSubmitting(false);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setImagePreviews([]);
  };

  // Collapsed state
  if (!isExpanded) {
    return (
      <>
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full wm-panel p-3 text-left hover:border-[var(--wm-border-strong)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              B
            </div>
            <span className="text-sm text-[var(--wm-text-faint)]">Bạn cần gì? Bạn có gì?</span>
          </div>
        </button>
        {toast && <Toast {...toast} />}
      </>
    );
  }

  return (
    <>
      <div className="wm-panel">
        <div className="wm-panel-header">
          <span className="wm-panel-title">Đăng nhu cầu</span>
          <button
            onClick={() => { resetForm(); }}
            className="p-1 hover:bg-[var(--wm-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--wm-text-muted)]" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Type Toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => { setType('CAN'); setSelectedImages([]); imagePreviews.forEach(u => URL.revokeObjectURL(u)); setImagePreviews([]); }}
              className={cn(
                'flex-1 py-2 text-sm font-semibold transition-colors border',
                type === 'CAN'
                  ? 'bg-red-500/15 text-red-500 border-red-500/25'
                  : 'bg-transparent text-[var(--wm-text-muted)] border-[var(--wm-border)] hover:bg-[var(--wm-surface-hover)]',
              )}
            >
              CẦN
            </button>
            <button
              onClick={() => setType('CO')}
              className={cn(
                'flex-1 py-2 text-sm font-semibold transition-colors border',
                type === 'CO'
                  ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
                  : 'bg-transparent text-[var(--wm-text-muted)] border-[var(--wm-border)] hover:bg-[var(--wm-surface-hover)]',
              )}
            >
              CÓ
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={PLACEHOLDERS[type]}
            rows={4}
            className="wm-input resize-none text-sm leading-relaxed"
            autoFocus
          />

          {/* AI Tags Preview */}
          {(showTags && tags.length > 0) && (
            <div className="p-2.5 border border-[var(--wm-border)] bg-[var(--wm-overlay-subtle)]">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--wm-primary)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wm-primary)]">
                  AI đã hiểu
                </span>
                {isParsing && <Loader2 className="w-3 h-3 animate-spin text-[var(--wm-text-muted)]" />}
              </div>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="wm-badge text-[9px] font-medium"
                    style={{ background: 'var(--wm-overlay-subtle)', color: 'var(--wm-text-dim)', border: '1px solid var(--wm-border)' }}
                  >
                    {tag.icon} {tag.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {isParsing && !showTags && (
            <div className="flex items-center gap-2 text-xs text-[var(--wm-text-muted)]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>AI đang phân tích...</span>
            </div>
          )}

          {/* Image Upload (CÓ only) */}
          {type === 'CO' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {imagePreviews.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 border border-[var(--wm-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center text-[10px] rounded-full"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {selectedImages.length < 10 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border border-dashed border-[var(--wm-border)] flex items-center justify-center gap-2 text-xs text-[var(--wm-text-muted)] hover:bg-[var(--wm-surface-hover)] hover:border-[var(--wm-border-strong)] transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>Thêm ảnh ({selectedImages.length}/10)</span>
                </button>
              )}
            </div>
          )}

          {/* Character hint + Submit */}
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              'text-[10px]',
              text.trim().length >= 10 ? 'text-emerald-400' : 'text-[var(--wm-text-faint)]',
            )}>
              {text.trim().length}/10 ký tự {text.trim().length < 10 ? '(tối thiểu 10)' : '✓'}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={text.trim().length < 10 || isSubmitting}
            className={cn(
              'w-full py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              type === 'CAN'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-600 hover:bg-emerald-700',
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : type === 'CAN' ? (
              'Đăng nhu cầu'
            ) : (
              'Đăng tin bán'
            )}
          </button>
        </div>
      </div>
      {toast && <Toast {...toast} />}
    </>
  );
}

function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={cn(
      'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-sm font-medium text-white shadow-lg rounded',
      type === 'success' ? 'bg-emerald-600' : 'bg-red-500',
    )}>
      {message}
    </div>
  );
}
