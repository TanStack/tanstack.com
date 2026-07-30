import type { ReactElement } from 'react'
import { splitName } from './template'

type ReadmeHeaderProps = {
  name: string
  tagline: string
  accentColor: string
  emblemSrc: string
}

const WIDTH = 1800
const HEIGHT = 450
const EMBLEM_SIZE = 200
const PADDING_X = 96
const ACCENT_BAR_HEIGHT = 18

export function buildReadmeHeaderTree(props: ReadmeHeaderProps): ReactElement {
  const [nameLine1, nameLine2] = splitName(props.name)

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        color: '#3e3529',
        fontFamily: 'Inter',
        backgroundColor: '#eeebd4',
        paddingLeft: PADDING_X,
        paddingRight: PADDING_X,
        paddingBottom: ACCENT_BAR_HEIGHT,
      }}
    >
      <img
        src={props.emblemSrc}
        alt=""
        width={EMBLEM_SIZE}
        height={EMBLEM_SIZE}
        style={{ marginRight: 72 }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Bricolage Grotesque',
            fontWeight: 700,
            lineHeight: 0.92,
            letterSpacing: '-2px',
            marginBottom: 22,
          }}
        >
          {nameLine2 ? <span style={{ fontSize: 44 }}>{nameLine1}</span> : null}
          <span style={{ fontSize: 96, color: props.accentColor }}>
            {nameLine2 || nameLine1}
          </span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 400, lineHeight: 1.3 }}>
          {props.tagline}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: ACCENT_BAR_HEIGHT,
          backgroundColor: props.accentColor,
        }}
      />
    </div>
  )
}
