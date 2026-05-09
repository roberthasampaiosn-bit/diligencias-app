import { AppProvider } from '@/context/AppContext'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/context/AuthContext'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </AuthGuard>
    </AuthProvider>
  )
}
