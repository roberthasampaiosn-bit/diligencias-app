'use client'

import { ReactNode } from 'react'
import { ToastProvider } from './ToastContext'
import { DiligenciasProvider, useDiligencias } from './DiligenciasContext'
import { AdvogadosProvider, useAdvogados } from './AdvogadosContext'
import { EventosProvider, useEventos } from './EventosContext'
import { ConsultaPlacasProvider, useConsultasPlacas } from './ConsultaPlacasContext'

export { useDiligencias, useAdvogados, useEventos, useConsultasPlacas }
export { useToast } from './ToastContext'

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DiligenciasProvider>
        <AdvogadosProvider>
          <EventosProvider>
            <ConsultaPlacasProvider>
              {children}
            </ConsultaPlacasProvider>
          </EventosProvider>
        </AdvogadosProvider>
      </DiligenciasProvider>
    </ToastProvider>
  )
}

export function useDbStatus() {
  const dil = useDiligencias()
  const adv = useAdvogados()
  const evt = useEventos()
  return {
    loading: dil.loading || adv.loading || evt.loading,
    error: dil.error ?? adv.error ?? evt.error,
  }
}

export function useApp() {
  return {
    ...useDiligencias(),
    ...useAdvogados(),
    ...useEventos(),
  }
}
