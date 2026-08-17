import type { ReactElement } from 'react'
import { splitName } from './template'

type ReadmeHeaderProps = {
  name: string
  tagline: string
  accentColor: string
  emblemSrc: string
  background: string
  secondaryText: string
}

const WIDTH = 1800
const HEIGHT = 450
const EMBLEM_SIZE = 200
const EMBLEM_GAP = 72
const PADDING_X = 96
const ACCENT_BAR_HEIGHT = 18

// The canvas is a fixed size, so text with nowhere to wrap bleeds off the edge
// instead of reflowing. Bound the text column to the space actually left over
// beside the emblem, the same way the 1200x630 template caps its own copy.
const TEXT_MAX_WIDTH = WIDTH - PADDING_X * 2 - EMBLEM_SIZE - EMBLEM_GAP

const NAME_FONT_SIZE = 96
const PREFIX_FONT_SIZE = 44
const TAGLINE_FONT_SIZE = 30

// `maxWidth` makes text wrap at spaces, but takumi supports no `wordBreak` or
// `overflowWrap`, so a single long token (`?title=` is capped by character
// count, not width) has nowhere to break and would run past the canvas edge.
// Scale such a line down until the estimate fits.
//
// ponytail: character-count estimate, not real text metrics — takumi exposes no
// measurement API. Ratios are eyeballed against the two fonts at their display
// sizes and only ever shrink text, so a bad guess costs a slightly small line,
// never an overflow. Swap in real advance widths if takumi ever exposes them.
function fitFontSize(
  text: string,
  baseSize: number,
  avgGlyphRatio: number,
  lines = 1,
): number {
  if (!text) return baseSize

  // Two independent constraints: the whole string has `lines` worth of width to
  // wrap into, but any single token has to fit on one line by itself, since
  // there is nowhere inside a token to break.
  const longestToken = text
    .split(/\s+/)
    .reduce((longest, token) => Math.max(longest, token.length), 0)

  const limit = (chars: number, budget: number) =>
    chars === 0 ? baseSize : budget / (chars * avgGlyphRatio)

  const fitted = Math.min(
    baseSize,
    limit(text.length, TEXT_MAX_WIDTH * lines),
    limit(longestToken, TEXT_MAX_WIDTH),
  )

  // Floor only guards against a zero/negative size; it must stay below what
  // the clamped inputs can compute (160 wide glyphs land around 12px) so the
  // width calculation, not the floor, decides the final size.
  return Math.max(8, Math.floor(fitted))
}

// Deliberately pessimistic — closer to the widest glyphs ('W', 'M') than to the
// average, so an all-caps worst case still lands inside the padding instead of
// exactly on it. Only text that already needs shrinking is affected.
const DISPLAY_GLYPH_RATIO = 0.95
const BODY_GLYPH_RATIO = 0.82

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
        color: props.secondaryText,
        fontFamily: 'Inter',
        backgroundColor: props.background,
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
        style={{ marginRight: EMBLEM_GAP }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: TEXT_MAX_WIDTH,
          overflow: 'hidden',
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
            maxWidth: TEXT_MAX_WIDTH,
          }}
        >
          {nameLine2 ? (
            <span
              style={{
                fontSize: fitFontSize(
                  nameLine1,
                  PREFIX_FONT_SIZE,
                  DISPLAY_GLYPH_RATIO,
                ),
              }}
            >
              {nameLine1}
            </span>
          ) : null}
          <span
            style={{
              fontSize: fitFontSize(
                nameLine2 || nameLine1,
                NAME_FONT_SIZE,
                DISPLAY_GLYPH_RATIO,
              ),
              color: props.accentColor,
            }}
          >
            {nameLine2 || nameLine1}
          </span>
        </div>
        <div
          style={{
            // Taglines wrap at spaces, so allow a two-line budget before
            // shrinking — only an unbreakable token actually needs it.
            fontSize: fitFontSize(
              props.tagline,
              TAGLINE_FONT_SIZE,
              BODY_GLYPH_RATIO,
              2,
            ),
            fontWeight: 400,
            lineHeight: 1.3,
            maxWidth: TEXT_MAX_WIDTH,
          }}
        >
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
