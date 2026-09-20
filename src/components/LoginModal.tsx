import { GithubIcon } from '~/components/icons/GithubIcon'
import { GoogleIcon } from '~/components/icons/GoogleIcon'
import { authClient } from '~/auth/client'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from '~/components/ds/ui'

interface LoginModalProps {
  open: boolean
  description?: string
  onOpenChange: (open: boolean) => void
}

export function LoginModal({
  open,
  description,
  onOpenChange,
}: LoginModalProps) {
  const openSocialPopup = (provider: 'github' | 'google') => {
    const popup = authClient.signIn.socialPopup({ provider })

    if (!popup) {
      authClient.signIn.social({ provider })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xs">
        <DialogHeader title="Sign in to continue" description={description} />
        <DialogBody className="pb-6">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => openSocialPopup('github')}
              className="w-full flex items-center justify-center gap-2 bg-background-inverse text-text-inverse font-medium py-2.5 px-4 rounded-lg transition-colors hover:bg-background-inverse/90"
            >
              <GithubIcon className="w-5 h-5" />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => openSocialPopup('google')}
              className="w-full flex items-center justify-center gap-2 bg-[#DB4437] hover:bg-[#c53929] text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <GoogleIcon className="w-5 h-5" />
              Continue with Google
            </button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
