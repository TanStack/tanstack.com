import { useState } from 'react'
import {
  avatarDesignSchema,
  readAvatar,
  type AvatarDesign,
} from '../core/avatar'
import { botAvatar } from './bot-sidebar'
import { BotAvatar } from './BotAvatar'
import { Button } from './ui/Button'

export function AvatarEditor({
  botId,
  name,
  nameEditable = true,
  value,
  busy,
  onSave,
}: {
  botId: string
  name: string
  nameEditable?: boolean
  value?: string | null
  busy: boolean
  onSave: (value: { name: string; avatar: string | null }) => Promise<void>
}) {
  const generated = botAvatar(botId)
  const defaults = (): AvatarDesign => ({
    hue: generated.hue,
    shape: generated.shape,
    eyes: generated.eyes,
    expression: generated.expression,
    nose: generated.nose,
    mouthless: generated.mouthless,
    eyeScale: generated.eyeScale,
    mouthScale: generated.mouthScale,
    eyeSpacing: generated.eyeSpacing,
  })
  const [design, setDesign] = useState<AvatarDesign>(() => ({
    ...defaults(),
    ...readAvatar(value),
  }))
  const [draftName, setDraftName] = useState(name)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const update = (patch: Partial<AvatarDesign>) =>
    setDesign((current) => ({ ...current, ...patch }))
  async function upload(file?: File) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
          file.type,
        ) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error('Choose a PNG, JPEG, WebP, or GIF under 10 MB.')
      const image = await createImageBitmap(file)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 128
        const context = canvas.getContext('2d')!
        const side = Math.min(image.width, image.height)
        context.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          128,
          128,
        )
        const data = canvas.toDataURL('image/webp', 0.8)
        if (data.length > 24000)
          throw new Error('This image is too detailed. Try a simpler image.')
        update({ image: data })
      } finally {
        image.close()
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load this image.',
      )
    } finally {
      setUploading(false)
    }
  }
  const colors = [
    ['Rose', '#df9caa'],
    ['Peach', '#e6b48e'],
    ['Gold', '#dfca83'],
    ['Sage', '#aec599'],
    ['Mint', '#9acbb9'],
    ['Sky', '#9dbfe0'],
    ['Lavender', '#bbacd8'],
    ['Lilac', '#d1a5cd'],
  ] as const
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        const nextName = draftName.trim()
        if (!nextName || nextName.length > 60) {
          setError('Use a name between 1 and 60 characters.')
          return
        }
        void onSave({
          name: nextName,
          avatar: JSON.stringify(avatarDesignSchema.parse(design)),
        }).catch((cause) => setError(cause.message))
      }}
    >
      <div className="avatar-editor-preview">
        <BotAvatar botId={botId} design={design} compactDot />
      </div>
      <fieldset
        className="bw-fields avatar-editor-fields"
        disabled={busy || uploading}
      >
        {nameEditable && (
          <label>
            Name
            <input
              value={draftName}
              maxLength={60}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
        )}
        <label>
          Use an image for your assistant
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {design.image ? (
          <Button onClick={() => update({ image: undefined })}>
            Use a dot instead
          </Button>
        ) : (
          <>
            <section className="avatar-editor-section">
              <h3>Color</h3>
              <div className="avatar-swatches">
                {colors.map(([name, color]) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={name}
                    title={name}
                    aria-pressed={design.color === color}
                    style={{ background: color }}
                    onClick={() => update({ color })}
                  />
                ))}
                <label className="avatar-custom-color" title="Custom color">
                  <input
                    type="color"
                    aria-label="Custom color"
                    value={design.color ?? '#aec599'}
                    onChange={(event) => update({ color: event.target.value })}
                  />
                </label>
              </div>
            </section>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="bw-form-actions">
          <Button onClick={() => setDesign(defaults())}>Reset</Button>
          <Button variant="primary" type="submit">
            {busy ? 'Saving…' : uploading ? 'Loading image…' : 'Save assistant'}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
