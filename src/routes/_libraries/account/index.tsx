import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/utils/auth.client'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useCapabilities } from '~/hooks/useCapabilities'
import { hasCapability } from '~/db/types'
import { useToast } from '~/components/ToastProvider'
import {
  updateAdPreference,
  revertProfileImage,
  removeProfileImage,
} from '~/utils/users.server'
import { getMyStreak } from '~/utils/activity.functions'
import {
  LogOut,
  Flame,
  Trophy,
  Calendar,
  Camera,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Card } from '~/components/Card'
import { Button } from '~/components/Button'
import { Avatar } from '~/components/Avatar'
import { AvatarCropModal } from '~/components/AvatarCropModal'
import { useUploadThing } from '~/utils/uploadthing'

export const Route = createFileRoute('/_libraries/account/')({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const userQuery = useCurrentUserQuery()
  const queryClient = useQueryClient()
  const capabilities = useCapabilities()
  const { notify } = useToast()
  const navigate = useNavigate()

  // Avatar upload state
  const [cropModalOpen, setCropModalOpen] = React.useState(false)
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isReverting, setIsReverting] = React.useState(false)
  const [isRemoving, setIsRemoving] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const { startUpload } = useUploadThing('avatarUploader', {
    onClientUploadComplete: () => {
      setIsUploading(false)
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      notify(
        <div>
          <div className="font-medium">Profile picture updated</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Your new avatar is now live
          </div>
        </div>,
      )
    },
    onUploadError: (error) => {
      setIsUploading(false)
      notify(
        <div>
          <div className="font-medium">Upload failed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            {error.message}
          </div>
        </div>,
      )
    },
  })

  const streakQuery = useQuery({
    queryKey: ['my-streak'],
    queryFn: () => getMyStreak(),
    enabled: !!userQuery.data,
  })

  // Get values directly from the current user data
  const user = userQuery.data
  const adsDisabled =
    user && typeof user === 'object' && 'adsDisabled' in user
      ? (user.adsDisabled ?? false)
      : false
  const canDisableAds = hasCapability(capabilities, 'disableAds')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setCropModalOpen(true)
      }
      reader.readAsDataURL(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsUploading(true)
    const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' })
    await startUpload([file])
  }

  const handleRevertToOAuth = async () => {
    if (!user?.oauthImage) return

    setIsReverting(true)
    try {
      await revertProfileImage()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      notify(
        <div>
          <div className="font-medium">Profile picture reverted</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Using your OAuth provider image
          </div>
        </div>,
      )
    } catch {
      notify(
        <div>
          <div className="font-medium">Error</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Failed to revert profile picture
          </div>
        </div>,
      )
    } finally {
      setIsReverting(false)
    }
  }

  const handleRemovePhoto = async () => {
    setIsRemoving(true)
    try {
      await removeProfileImage()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      notify(
        <div>
          <div className="font-medium">Profile picture removed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Using default avatar
          </div>
        </div>,
      )
    } catch {
      notify(
        <div>
          <div className="font-medium">Error</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Failed to remove profile picture
          </div>
        </div>,
      )
    } finally {
      setIsRemoving(false)
    }
  }

  const hasCustomImage = user?.image && user.image !== user.oauthImage
  const canRevert = hasCustomImage && user?.oauthImage
  const hasAnyImage = user?.image || user?.oauthImage

  const handleToggleAds = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      await updateAdPreference({ data: { adsDisabled: e.target.checked } })
      notify(
        <div>
          <div className="font-medium">Preferences updated</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Ad visibility preference saved
          </div>
        </div>,
      )
    } catch (error) {
      notify(
        <div>
          <div className="font-medium">Error</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Failed to update preferences
          </div>
        </div>,
      )
    }
  }

  const signOut = async () => {
    await authClient.signOut()
    navigate({ to: '/login' })
    notify(
      <div>
        <div className="font-medium">Signed out</div>
        <div className="text-gray-500 dark:text-gray-400 text-xs">
          You have been logged out
        </div>
      </div>,
    )
  }

  return (
    <Card className="p-4 flex flex-col gap-y-6 max-w-lg">
      <div>
        <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
          Profile Picture
        </h3>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar
              image={user?.image}
              oauthImage={user?.oauthImage}
              name={user?.name}
              email={user?.email}
              size="xl"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Camera className="w-3.5 h-3.5" />
              {isUploading ? 'Uploading...' : 'Change photo'}
            </Button>
            {canRevert && (
              <Button onClick={handleRevertToOAuth} disabled={isReverting}>
                <RotateCcw className="w-3.5 h-3.5" />
                {isReverting ? 'Reverting...' : 'Revert to original'}
              </Button>
            )}
            {hasAnyImage && (
              <Button onClick={handleRemovePhoto} disabled={isRemoving}>
                <Trash2 className="w-3.5 h-3.5" />
                {isRemoving ? 'Removing...' : 'Remove photo'}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div>
        <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
          Connections
        </h3>
        <div className="flex flex-col gap-y-4 text-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="font-medium">
              Email
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md py-1 px-2 w-full max-w-xs"
              value={
                user && typeof user === 'object' && 'email' in user
                  ? (user.email ?? '')
                  : ''
              }
              disabled
            />
          </div>
        </div>
      </div>

      {/* Avatar crop modal */}
      {selectedImage && (
        <AvatarCropModal
          open={cropModalOpen}
          onOpenChange={(open) => {
            setCropModalOpen(open)
            if (!open) setSelectedImage(null)
          }}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
        />
      )}
      {canDisableAds && (
        <div>
          <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
            Preferences
          </h3>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600 my-1"
                checked={adsDisabled}
                onChange={handleToggleAds}
                disabled={userQuery.isLoading}
                aria-label="Disable Ads"
              />
              <div>
                <div className="font-medium">Disable Ads</div>
                <div className="text-sm opacity-70">
                  Hide ads when you are signed in
                </div>
              </div>
            </label>
          </div>
        </div>
      )}
      <div>
        <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
          Activity
        </h3>
        {streakQuery.isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : streakQuery.data ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Flame className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {streakQuery.data.currentStreak}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Current Streak
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {streakQuery.data.longestStreak}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Best Streak
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-500 mb-1" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {streakQuery.data.totalActiveDays}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Active Days
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <div>
        <Button onClick={signOut}>
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </Button>
      </div>
    </Card>
  )
}
