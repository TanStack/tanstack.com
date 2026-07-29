import type { ReactElement } from 'react'

type TemplateProps = {
  libraryName: string
  accentColor: string
  brandLogoSrc: string
  pitch: string
  docTitle?: string
  description?: string
}

const WIDTH = 1200
const HEIGHT = 630

// "TanStack AI" → ["TanStack", "AI"]
// "TanStack Router" → ["TanStack", "Router"]
// "Create TS Router App" → ["Create TS Router", "App"] (fallback: last word)
function splitName(name: string): [string, string] {
  const parts = name.split(' ')
  if (parts.length < 2) return [name, '']
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return [first, last]
}

export function buildOgTree(props: TemplateProps): ReactElement {
  const [titleLine1, titleLine2] = splitName(props.libraryName)
  const hasPageDetail = Boolean(props.docTitle || props.description)

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        position: 'relative',
        color: '#111111',
        fontFamily: 'Inter',
        backgroundColor: '#eeebd4',
      }}
    >
      <img
        src={props.brandLogoSrc}
        alt=""
        width={321}
        height={50}
        style={{
          position: 'absolute',
          left: 64,
          top: 52,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          top: 152,
          bottom: 52,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginBottom: hasPageDetail ? 20 : 28,
            fontFamily: 'Bricolage Grotesque',
            fontWeight: 700,
            lineHeight: 0.92,
            letterSpacing: '-2px',
          }}
        >
          <span
            style={{
              fontSize: hasPageDetail ? 36 : 58,
              color: '#3e3529',
            }}
          >
            {titleLine1}
          </span>
          {titleLine2 ? (
            <span
              style={{
                fontSize: hasPageDetail ? 60 : 92,
                color: props.accentColor,
              }}
            >
              {titleLine2}
            </span>
          ) : null}
        </div>
        {!props.docTitle && !props.description && props.pitch ? (
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.3,
              color: '#3e3529',
              marginBottom: 0,
              maxWidth: 920,
            }}
          >
            {props.pitch}
          </div>
        ) : null}
        {props.docTitle ? (
          <div
            style={{
              fontSize: 44,
              fontFamily: 'Bricolage Grotesque',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-1px',
              marginBottom: 14,
              color: '#111111',
            }}
          >
            {props.docTitle}
          </div>
        ) : null}
        {props.description ? (
          <div
            style={{
              fontSize: 22,
              lineHeight: 1.3,
              fontWeight: 400,
              color: '#3e3529',
              maxWidth: 980,
            }}
          >
            {props.description}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 16,
          backgroundColor: props.accentColor,
        }}
      />
    </div>
  )
}
