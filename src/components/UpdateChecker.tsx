'use client'

import { useEffect, useRef, useState } from 'react'

// Versão que ESTE navegador carregou (embutida no bundle em build time).
const VERSAO_CARREGADA = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

// Auto-atualizador: compara a versão carregada no navegador com a versão
// publicada em produção (/api/version). Quando saiu uma versão nova:
//  1) mostra um botão discreto "Atualizar" (a usuária clica quando quiser);
//  2) recarrega SOZINHO quando a aba volta a ficar visível (ex.: ela sai pro
//     WhatsApp e volta) — momento seguro, pois não está digitando naquele
//     instante. Assim ela nunca mais fica presa numa versão antiga.
export function UpdateChecker() {
  const [temAtualizacao, setTemAtualizacao] = useState(false)
  const checando = useRef(false)
  const temAtualizacaoRef = useRef(false)

  // Mantém o ref em sincronia para os listeners lerem o valor atual.
  useEffect(() => { temAtualizacaoRef.current = temAtualizacao }, [temAtualizacao])

  useEffect(() => {
    // Em desenvolvimento não faz sentido ficar checando.
    if (VERSAO_CARREGADA === 'dev') return
    let cancelado = false

    async function checar() {
      if (checando.current || document.visibilityState !== 'visible') return
      checando.current = true
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { version?: string }
        if (!cancelado && data.version && data.version !== VERSAO_CARREGADA) {
          setTemAtualizacao(true)
        }
      } catch {
        /* rede instável — ignora, tenta de novo depois */
      } finally {
        checando.current = false
      }
    }

    function recarregarSeSeguro() {
      if (document.visibilityState !== 'visible' || !temAtualizacaoRef.current) return
      // Não recarrega se ela estiver digitando num campo (evita perder dados).
      const el = document.activeElement as HTMLElement | null
      const digitando =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (!digitando) window.location.reload()
    }

    function aoVoltarAoApp() {
      if (document.visibilityState !== 'visible') return
      // Se já sabemos que há atualização, recarrega ao voltar. Senão, checa.
      if (temAtualizacaoRef.current) recarregarSeSeguro()
      else checar()
    }

    const inicial = setTimeout(checar, 3000)          // 1ª checagem logo após abrir
    const intervalo = setInterval(checar, 60_000)     // e a cada 1 min
    window.addEventListener('focus', aoVoltarAoApp)
    document.addEventListener('visibilitychange', aoVoltarAoApp)

    return () => {
      cancelado = true
      clearTimeout(inicial)
      clearInterval(intervalo)
      window.removeEventListener('focus', aoVoltarAoApp)
      document.removeEventListener('visibilitychange', aoVoltarAoApp)
    }
  }, [])

  if (!temAtualizacao) return null

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed bottom-4 right-4 z-[9999] inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700 transition-colors animate-pulse"
      aria-label="Atualizar para a versão mais nova"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      Nova versão — Atualizar
    </button>
  )
}
