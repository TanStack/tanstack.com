import * as v from 'valibot'

const coordinateSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.transform(Number),
  v.finite(),
)

const visitorLocationSchema = v.object({
  latitude: v.pipe(coordinateSchema, v.minValue(-90), v.maxValue(90)),
  longitude: v.pipe(coordinateSchema, v.minValue(-180), v.maxValue(180)),
})

export function parseVisitorLocation(metadata: unknown) {
  const result = v.safeParse(visitorLocationSchema, metadata)
  return result.success ? result.output : null
}
