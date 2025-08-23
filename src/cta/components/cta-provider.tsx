import { useManager } from '../store/project'
import { Toaster } from './toaster'

export function CTAProvider({ children }: { children: React.ReactNode }) {
  useManager()
  
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
