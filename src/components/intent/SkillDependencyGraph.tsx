import * as React from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  scaleLinear,
  scaleOrdinal,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3'
import { arrow, defineChart, dot, text } from '@tanstack/charts'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/react-charts'
import { useNavigate } from '@tanstack/react-router'
import { SKILL_TYPE_STYLES } from '~/routes/intent/registry/$packageName'

interface SkillNode {
  name: string
  type: string | null
  requires: Array<string> | null
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  type: string | null
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string
  source: string | GraphNode
  target: string | GraphNode
}

interface PositionedNode {
  id: string
  kind: 'node'
  type: string
  x: number
  y: number
}

interface PositionedLink {
  id: string
  kind: 'link'
  x1: number
  x2: number
  y1: number
  y2: number
}

type DependencyGraphInput = {
  height: number
  links: Array<PositionedLink>
  nodes: Array<PositionedNode>
  width: number
}

const typeColors = {
  core: '#8b5cf6',
  'sub-skill': '#6b7280',
  framework: '#f59e0b',
  lifecycle: '#10b981',
  composition: '#3b82f6',
  security: '#ef4444',
  default: '#9ca3af',
} as const

function createDependencyGraph(input: DependencyGraphInput) {
  return defineChart({
    marks: [
      arrow(input.links, {
        id: 'skill-dependencies',
        x1: 'x1',
        y1: 'y1',
        x2: 'x2',
        y2: 'y2',
        key: 'id',
        stroke: 'currentColor',
        strokeOpacity: 0.24,
        strokeWidth: 1.5,
        headLength: 7,
      }),
      dot(input.nodes, {
        id: 'skills',
        x: 'x',
        y: 'y',
        z: 'type',
        key: 'id',
        r: 6,
        stroke: 'currentColor',
        strokeOpacity: 0.3,
        strokeWidth: 1.5,
      }),
      text(input.nodes, {
        id: 'skill-labels',
        x: 'x',
        y: 'y',
        text: 'id',
        key: 'id',
        fill: 'currentColor',
        fontSize: 10,
        fontWeight: 500,
        dy: 18,
      }),
    ],
    x: {
      scale: scaleLinear().domain([0, input.width]),
    },
    y: {
      scale: scaleLinear().domain([input.height, 0]),
    },
    color: {
      scale: scaleOrdinal<string, string>()
        .domain(Object.keys(typeColors))
        .range(Object.values(typeColors)),
    },
    guides: false,
    margin: 0,
    theme: { background: 'transparent' },
    tooltip: {
      use: tooltip,
      format: (point) =>
        point.datum.kind === 'node' ? point.datum.id : 'Dependency',
    },
  })
}

export function SkillDependencyGraph({
  skills,
  packageName,
}: {
  readonly skills: Array<SkillNode>
  readonly packageName: string
}) {
  const navigate = useNavigate()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 })
  const [layout, setLayout] = React.useState<{
    links: Array<PositionedLink>
    nodes: Array<PositionedNode>
  }>({ links: [], nodes: [] })

  const graph = React.useMemo(() => {
    const skillNames = new Set(skills.map((skill) => skill.name))
    const nodes: Array<GraphNode> = skills.map((skill) => ({
      id: skill.name,
      type: skill.type,
    }))
    const links = skills.flatMap((skill) =>
      (skill.requires ?? [])
        .filter((requiredSkill) => skillNames.has(requiredSkill))
        .map((requiredSkill) => ({
          id: `${skill.name}:${requiredSkill}`,
          source: skill.name,
          target: requiredSkill,
        })),
    )

    return { links, nodes }
  }, [skills])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = entry.contentRect.width
      setDimensions({
        width,
        height: Math.min(Math.max(width * 0.6, 200), 400),
      })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (dimensions.width === 0 || graph.nodes.length === 0) return

    const nodes = graph.nodes.map((node) => ({ ...node }))
    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(
          graph.links.map((link) => ({ ...link })),
        )
          .id((node) => node.id)
          .distance(80),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', forceCollide(35))
      .stop()

    simulation.tick(200)

    const positionedNodes = nodes.flatMap(
      (node): Array<PositionedNode> =>
        typeof node.x === 'number' && typeof node.y === 'number'
          ? [
              {
                id: node.id,
                kind: 'node',
                type: node.type ?? 'default',
                x: node.x,
                y: node.y,
              },
            ]
          : [],
    )
    const nodeById = new Map(positionedNodes.map((node) => [node.id, node]))
    const positionedLinks = graph.links.flatMap(
      (link): Array<PositionedLink> => {
        const source = nodeById.get(link.source)
        const target = nodeById.get(link.target)
        if (!source || !target) return []

        const dx = target.x - source.x
        const dy = target.y - source.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance === 0) return []

        const offsetX = (dx / distance) * 10
        const offsetY = (dy / distance) * 10
        return [
          {
            id: link.id,
            kind: 'link',
            x1: source.x + offsetX,
            y1: source.y + offsetY,
            x2: target.x - offsetX,
            y2: target.y - offsetY,
          },
        ]
      },
    )

    setLayout({ links: positionedLinks, nodes: positionedNodes })
    return () => {
      simulation.stop()
    }
  }, [dimensions, graph])

  const dependencyGraph = React.useMemo(
    () => createDependencyGraph({ ...layout, ...dimensions }),
    [dimensions, layout],
  )

  if (graph.links.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30"
    >
      {dimensions.width > 0 && layout.nodes.length > 0 ? (
        <Chart
          definition={dependencyGraph}
          width={dimensions.width}
          height={dimensions.height}
          ariaLabel={`Dependencies between skills in ${packageName}`}
          onSelect={(point) => {
            const datum = point?.datum
            if (!datum || datum.kind !== 'node') return
            void navigate({
              to: '/intent/registry/$packageName/$skillName',
              params: { packageName, skillName: datum.id },
            })
          }}
        />
      ) : null}

      <div className="flex items-center gap-3 px-3 py-2 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500">
        <span className="uppercase tracking-wider font-medium">
          Dependencies
        </span>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        {Object.entries(SKILL_TYPE_STYLES)
          .filter(([type]) => skills.some((skill) => skill.type === type))
          .map(([type]) => (
            <span key={type} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: getTypeColor(type),
                }}
              />
              {type}
            </span>
          ))}
      </div>
    </div>
  )
}

function getTypeColor(type: string) {
  switch (type) {
    case 'core':
      return typeColors.core
    case 'sub-skill':
      return typeColors['sub-skill']
    case 'framework':
      return typeColors.framework
    case 'lifecycle':
      return typeColors.lifecycle
    case 'composition':
      return typeColors.composition
    case 'security':
      return typeColors.security
    default:
      return typeColors.default
  }
}
