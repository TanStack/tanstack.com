import { botAvatar } from './bot-sidebar'
import type { CSSProperties } from 'react'
import { readAvatar, type AvatarDesign } from '../core/avatar'

// Round, square, pebble, rounded triangle, scalloped, and domed silhouettes.
const silhouettes = [
  'M24 4A20 20 0 1 1 24 44A20 20 0 1 1 24 4Z',
  'M14 5H34Q43 5 43 14V34Q43 43 34 43H14Q5 43 5 34V14Q5 5 14 5Z',
  'M25 4C37 4 45 17 42 30S29 45 17 42 2 32 6 20 15 4 25 4Z',
  'M18 7Q24 0 30 7L44 32Q49 43 36 43H12Q-1 43 4 32Z',
  'M24 8C31 -1 40 4 39 14C50 16 48 28 40 31C43 42 32 48 24 40C16 48 5 42 8 31C0 28 -2 16 9 14C8 4 17 -1 24 8Z',
  'M4 25C4 -3 44 -3 44 25V34Q44 43 35 43H13Q4 43 4 34Z',
]

export function BotAvatar({
  botId,
  working = false,
  active = false,
  customization,
  design,
  compactDot = false,
}: {
  botId: string
  working?: boolean
  active?: boolean
  customization?: string | null
  design?: Partial<AvatarDesign>
  compactDot?: boolean
}) {
  const avatar = {
    ...botAvatar(botId),
    ...readAvatar(customization),
    ...design,
    ...(compactDot
      ? {
          shape: 0,
          eyes: 1,
          expression: 2,
          nose: 0,
          mouthless: false,
          eyeScale: 0.8,
          mouthScale: 0.7,
          eyeSpacing: 5.8,
        }
      : {}),
  }
  const customColor =
    typeof avatar.color === 'string' ? avatar.color : undefined
  const brightness = customColor
    ? [1, 3, 5].reduce(
        (sum, offset, index) =>
          sum +
          parseInt(customColor.slice(offset, offset + 2), 16) *
            [0.299, 0.587, 0.114][index],
        0,
      )
    : 255
  return (
    <span
      className={`bw-avatar bw-avatar-${avatar.color}${working ? ' bw-avatar-working' : ''}`}
      aria-hidden
      data-motion={avatar.motion}
      data-active={active || working || undefined}
      style={
        {
          '--bw-avatar-fill':
            customColor ??
            `light-dark(hsl(${avatar.hue} 38% 80%), hsl(${avatar.hue} 25% 49%))`,
          '--bw-avatar-ink': customColor
            ? brightness < 115
              ? '#f6f6f6'
              : '#252931'
            : `light-dark(hsl(${avatar.hue} 35% 25%), hsl(${avatar.hue} 40% 12%))`,
        } as CSSProperties
      }
    >
      {avatar.image ? (
        <img src={avatar.image} alt="" />
      ) : (
        <svg viewBox="0 0 48 48" focusable="false">
          <path className="bw-avatar-body" d={silhouettes[avatar.shape]} />
          <g className="bw-avatar-face">
            {[24 - avatar.eyeSpacing, 24 + avatar.eyeSpacing].map(
              (x, index) => (
                <g
                  key={x}
                  transform={`translate(${x} ${(avatar.mouthless ? 25 : 22) + avatar.eyeHeight}) rotate(${avatar.eyeAngle}) scale(${avatar.eyeScale}) translate(${-x} ${avatar.mouthless ? -25 : -22})`}
                >
                  {avatar.mouthless ? (
                    <circle cx={x} cy="25" r="2.8" />
                  ) : avatar.eyes === 2 ||
                    (avatar.eyes === 3 && index === 1) ? (
                    <path
                      key={x}
                      className="bw-avatar-mouth"
                      d={`M${x - 2.5} 23Q${x} 19 ${x + 2.5} 23`}
                    />
                  ) : (
                    <ellipse
                      key={x}
                      cx={x}
                      cy="22"
                      rx={avatar.eyes === 1 ? 1.5 : 2.1}
                      ry={avatar.eyes === 1 ? 1.5 : 2.7}
                    />
                  )}
                  {(avatar.mouthless ||
                    (avatar.eyeScale >= 1.2 &&
                      avatar.eyes !== 1 &&
                      avatar.eyes !== 2 &&
                      !(avatar.eyes === 3 && index === 1))) && (
                    <circle
                      cx={x - 0.7}
                      cy={avatar.mouthless ? 24.2 : 21.2}
                      r={avatar.mouthless ? 0.7 : 0.55}
                      fill="white"
                      fillOpacity=".8"
                    />
                  )}
                </g>
              ),
            )}
            {avatar.nose === 1 && (
              <circle cx="24" cy="27" r="1.2" opacity=".7" />
            )}
            {avatar.nose === 2 && (
              <path
                className="bw-avatar-mouth"
                d="M24 24L22.5 28H25"
                strokeWidth="1.3"
              />
            )}
            {avatar.nose === 3 && (
              <ellipse cx="24" cy="27" rx="1.8" ry="1.1" opacity=".65" />
            )}
            {!avatar.mouthless && (
              <path
                className="bw-avatar-mouth"
                transform={`translate(${24 + avatar.mouthOffset} ${32 + avatar.mouthHeight}) rotate(${avatar.mouthAngle}) scale(${avatar.mouthScale}) translate(-24 -32)`}
                d={
                  avatar.expression === 0
                    ? 'M20 31Q24 34 28 31'
                    : avatar.expression === 1
                      ? 'M19 31Q24 38 29 31Z'
                      : avatar.expression === 2
                        ? 'M21 32Q24 35 27 32'
                        : avatar.expression === 3
                          ? 'M18 31Q24 37 30 31'
                          : 'M21 32Q24 36 27 32Z'
                }
              />
            )}
          </g>
        </svg>
      )}
    </span>
  )
}
