const tiles = [
  { height: 50, left: 0, top: 0, width: 40 },
  { height: 30, left: 40, top: 0, width: 35 },
  { height: 30, left: 75, top: 0, width: 25 },
  { height: 20, left: 40, top: 30, width: 20 },
  { height: 20, left: 60, top: 30, width: 40 },
  { height: 50, left: 0, top: 50, width: 25 },
  { height: 30, left: 25, top: 50, width: 25 },
  { height: 30, left: 50, top: 50, width: 30 },
  { height: 30, left: 80, top: 50, width: 20 },
  { height: 20, left: 25, top: 80, width: 18 },
  { height: 20, left: 43, top: 80, width: 22 },
  { height: 20, left: 65, top: 80, width: 35 },
]

export default function PlaceholderOssSponsors() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gray-200 dark:bg-gray-800">
      {tiles.map((tile, index) => (
        <div
          key={index}
          className="absolute animate-pulse border border-white/70 bg-gray-300 dark:border-gray-950/70 dark:bg-gray-700"
          style={{
            height: `${tile.height}%`,
            left: `${tile.left}%`,
            opacity: 0.5 + (index % 4) * 0.08,
            top: `${tile.top}%`,
            width: `${tile.width}%`,
          }}
        />
      ))}
    </div>
  )
}
