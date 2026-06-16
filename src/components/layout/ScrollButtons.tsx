'use client'

import { useEffect, useState, type RefObject } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface ScrollButtonsProps {
  /** Container que realmente rola (no app é o <main>). */
  targetRef: RefObject<HTMLElement | null>
}

/**
 * Botões flutuantes de rolagem para páginas longas.
 * Cada toque rola ~85% da altura visível na direção escolhida —
 * basta apertar quantas vezes precisar para subir ou descer.
 * Some automaticamente quando a página cabe na tela.
 */
export function ScrollButtons({ targetRef }: ScrollButtonsProps) {
  const [canScroll, setCanScroll] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const check = () => {
      const scrollable = el.scrollHeight > el.clientHeight + 20
      setCanScroll(scrollable)
      setAtTop(el.scrollTop <= 4)
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [targetRef])

  if (!canScroll) return null

  const step = (dir: 1 | -1) => {
    const el = targetRef.current
    if (!el) return
    el.scrollBy({ top: dir * el.clientHeight * 0.85, behavior: 'smooth' })
  }

  const btn =
    'flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 ' +
    'shadow-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition ' +
    'disabled:opacity-30 disabled:pointer-events-none'

  return (
    <div className="fixed right-3 bottom-24 z-40 flex flex-col gap-2 print:hidden">
      <button onClick={() => step(-1)} disabled={atTop} aria-label="Subir" title="Subir">
        <span className={btn}><ChevronUp className="w-5 h-5" /></span>
      </button>
      <button onClick={() => step(1)} disabled={atBottom} aria-label="Descer" title="Descer">
        <span className={btn}><ChevronDown className="w-5 h-5" /></span>
      </button>
    </div>
  )
}
