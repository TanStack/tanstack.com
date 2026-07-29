type ChartsCatalogDocsTarget = {
  anchor: string
  path: string
}

export const chartsCatalogDocsTargets: Record<string, ChartsCatalogDocsTarget> =
  {
    '01-line-gaps': { anchor: '3-mount-it', path: 'quick-start' },
    '02-multi-line-end-labels': {
      anchor: 'example',
      path: 'framework/react/quick-start',
    },
    '03-temperature-range-band': {
      anchor: 'complete-range-band-composition',
      path: 'concepts/marks-and-layering',
    },
    '04-stacked-time-area': {
      anchor: 'preserve-totals-with-a-stacked-area',
      path: 'examples/stacked-and-composition',
    },
    '13-interval-timeline': {
      anchor: 'show-scheduled-spans',
      path: 'examples/intervals-and-financial',
    },
    '14-error-bars': {
      anchor: 'preserve-uncertainty-bounds',
      path: 'examples/intervals-and-financial',
    },
    '15-boxplot': {
      anchor: 'compare-compact-summaries',
      path: 'examples/distributions',
    },
    '16-lollipop': {
      anchor: 'reduce-visual-weight-with-lollipops',
      path: 'examples/bars-and-rankings',
    },
    '17-dumbbell': {
      anchor: 'compare-two-values-per-category',
      path: 'examples/bars-and-rankings',
    },
    '19-moving-average-line': {
      anchor: 'show-a-derived-trend-honestly',
      path: 'examples/lines-and-areas',
    },
    '20-normalized-stacked-area': {
      anchor: 'compare-proportional-mix',
      path: 'examples/stacked-and-composition',
    },
    '21-streamgraph': {
      anchor: 'emphasize-changing-shape',
      path: 'examples/stacked-and-composition',
    },
    '22-bollinger-band': {
      anchor: 'add-context-with-an-interval',
      path: 'examples/lines-and-areas',
    },
    '24-quantitative-binned-heatmap': {
      anchor: 'aggregate-into-quantitative-cells',
      path: 'examples/heatmaps-and-densities',
    },
    '25-calendar-heatmap': {
      anchor: 'example',
      path: 'framework/octane/quick-start',
    },
    '28-candlestick': {
      anchor: 'encode-open-high-low-and-close',
      path: 'examples/intervals-and-financial',
    },
    '29-waterfall': {
      anchor: 'explain-a-bridge-to-a-total',
      path: 'examples/bars-and-rankings',
    },
    '30-slopegraph': {
      anchor: 'label-before-and-after-change',
      path: 'examples/annotations-and-overlays',
    },
    '31-linear-regression': {
      anchor: 'add-a-prepared-regression',
      path: 'examples/scatterplots-and-relationships',
    },
    '32-change-arrows': {
      anchor: 'show-two-dimensional-movement',
      path: 'examples/annotations-and-overlays',
    },
    '33-difference-chart': {
      anchor: 'a-chart-is-a-composition',
      path: 'overview',
    },
    '35-grouped-tooltip': {
      anchor: 'axis-focus-strategies',
      path: 'guides/tooltips-and-focus',
    },
    '36-hierarchy-tree': {
      anchor: 'show-a-strict-hierarchy',
      path: 'examples/networks-and-hierarchies',
    },
    '37-delaunay-network': {
      anchor: 'reveal-spatial-adjacency',
      path: 'examples/networks-and-hierarchies',
    },
    '38-contour-topography': {
      anchor: 'separate-point-and-scale-values',
      path: 'guides/custom-marks-and-renderers',
    },
    '39-density-contours': {
      anchor: 'summarize-a-continuous-field-with-contours',
      path: 'examples/heatmaps-and-densities',
    },
    '40-force-directed-network': {
      anchor: 'explore-an-unconstrained-dependency-graph',
      path: 'examples/networks-and-hierarchies',
    },
    '40-geojson-map': {
      anchor: 'compare-regional-aggregates',
      path: 'examples/maps-and-spatial',
    },
    '42-vector-field': {
      anchor: 'show-direction-and-magnitude',
      path: 'examples/maps-and-spatial',
    },
    '43-hexbin-density': {
      anchor: 'retain-local-structure-with-hexagonal-bins',
      path: 'examples/heatmaps-and-densities',
    },
    '44-framed-scatter': {
      anchor: 'automatic-guide-space',
      path: 'guides/responsive-charts',
    },
    '50-empirical-cdf': {
      anchor: 'preserve-every-rank-with-an-ecdf',
      path: 'examples/distributions',
    },
    '51-faceted-distributions': {
      anchor: 'repeat-one-encoding-by-group',
      path: 'examples/facets-and-multiple-views',
    },
    '53-log-scale-scatter': {
      anchor: 'log-scale-example',
      path: 'concepts/scales-and-d3',
    },
    '55-indexed-multi-line': {
      anchor: 'compare-several-series-from-a-common-baseline',
      path: 'examples/lines-and-areas',
    },
    '56-connected-scatter': {
      anchor: 'connect-observations-only-when-order-matters',
      path: 'examples/scatterplots-and-relationships',
    },
    '57-scatter-marginal-histograms': {
      anchor: 'add-marginal-context',
      path: 'examples/facets-and-multiple-views',
    },
    '58-select-extrema': {
      anchor: 'annotate-selected-observations',
      path: 'examples/lines-and-areas',
    },
    '60-lag-autocorrelation': {
      anchor: 'compare-each-observation-with-its-predecessor',
      path: 'examples/scatterplots-and-relationships',
    },
    '61-quantile-ribbon': {
      anchor: 'show-an-interval-over-time',
      path: 'examples/intervals-and-financial',
    },
    '63-violin-distributions': {
      anchor: 'compare-detailed-group-shapes',
      path: 'examples/distributions',
    },
    '64-marimekko-mosaic': {
      anchor: 'encode-two-part-to-whole-dimensions',
      path: 'examples/stacked-and-composition',
    },
    '65-voronoi-nearest-tooltip': {
      anchor: 'use-spatial-focus-for-dense-points',
      path: 'examples/scatterplots-and-relationships',
    },
    '70-composed-chart': {
      anchor: 'layers-build-richer-charts',
      path: 'concepts/grammar-of-graphics',
    },
    '73-many-point-scatter': {
      anchor: 'bounded-representations',
      path: 'guides/large-data',
    },
    '75-radar': { anchor: 'radar-profile', path: 'examples/polar-and-radar' },
    '76-pie': { anchor: 'pie-and-donut', path: 'examples/polar-and-radar' },
    '77-donut': { anchor: 'pie-and-donut', path: 'examples/polar-and-radar' },
    '78-gauge': {
      anchor: 'partial-circle-gauge',
      path: 'examples/polar-and-radar',
    },
    '82-chart-table-selection': {
      anchor: 'linked-table-pattern',
      path: 'guides/accessibility',
    },
    '83-focus-context-window': {
      anchor: 'pair-detail-with-context',
      path: 'examples/facets-and-multiple-views',
    },
    '84-pinned-nested-chart-tooltip': {
      anchor: 'pin-rich-nested-detail',
      path: 'examples/interactive-charts',
    },
    '85-scrollable-resource-lanes': {
      anchor: 'scroll-a-wide-schedule',
      path: 'examples/interactive-charts',
    },
    '86-streaming-window-preservation': {
      anchor: 'keys-reconciliation-and-animation',
      path: 'concepts/chart-definitions',
    },
    '89-brush-range-selection': {
      anchor: 'brush-selection',
      path: 'guides/interactions-and-selections',
    },
    '90-zoomable-time-window': {
      anchor: 'zoom-and-pan-a-time-domain',
      path: 'examples/interactive-charts',
    },
    '91-timeline-playback-scrubber': {
      anchor: 'animation',
      path: 'guides/dynamic-data-and-animation',
    },
    '92-editable-event-range': {
      anchor: 'edit-an-interval',
      path: 'examples/interactive-charts',
    },
    '93-labeled-pie': {
      anchor: 'pie-and-donut',
      path: 'examples/polar-and-radar',
    },
    '94-center-donut': {
      anchor: 'pie-and-donut',
      path: 'examples/polar-and-radar',
    },
    '95-rounded-donut': {
      anchor: 'pie-and-donut',
      path: 'examples/polar-and-radar',
    },
    '96-nested-donut': {
      anchor: 'pie-and-donut',
      path: 'examples/polar-and-radar',
    },
    '97-rose': {
      anchor: 'radial-magnitude-and-hierarchy',
      path: 'examples/polar-and-radar',
    },
    '98-needle-gauge': {
      anchor: 'partial-circle-gauge',
      path: 'examples/polar-and-radar',
    },
    '99-comparative-radar': {
      anchor: 'radar-profile',
      path: 'examples/polar-and-radar',
    },
    '100-radial-bars': {
      anchor: 'radial-magnitude-and-hierarchy',
      path: 'examples/polar-and-radar',
    },
    '101-sunburst': {
      anchor: 'radial-magnitude-and-hierarchy',
      path: 'examples/polar-and-radar',
    },
    '102-world-choropleth': {
      anchor: 'compare-regional-aggregates',
      path: 'examples/maps-and-spatial',
    },
    '103-bubble-map': {
      anchor: 'project-points-by-magnitude',
      path: 'examples/maps-and-spatial',
    },
    '104-orthographic-globe': {
      anchor: 'change-the-projection',
      path: 'examples/maps-and-spatial',
    },
    '105-route-map': {
      anchor: 'layer-routes-over-geography',
      path: 'examples/maps-and-spatial',
    },
    '106-polar-line': {
      anchor: 'numeric-polar-line-and-scatter',
      path: 'examples/polar-and-radar',
    },
    '107-polar-scatter': {
      anchor: 'numeric-polar-line-and-scatter',
      path: 'examples/polar-and-radar',
    },
    '108-country-choropleth': {
      anchor: 'compare-regional-aggregates',
      path: 'examples/maps-and-spatial',
    },
    '109-us-state-choropleth': {
      anchor: 'compare-regional-aggregates',
      path: 'examples/maps-and-spatial',
    },
    '110-projection-gallery': {
      anchor: 'change-the-projection',
      path: 'examples/maps-and-spatial',
    },
    'bar-grouped': {
      anchor: 'categorical-legend',
      path: 'guides/legends-and-color',
    },
    'bar-horizontal-ranking': {
      anchor: 'complete-horizontal-ranking',
      path: 'concepts/layout-axes-and-coordinates',
    },
    'bar-vertical-sorted': {
      anchor: 'rank-categories-with-bars',
      path: 'examples/bars-and-rankings',
    },
    'facets-anscombe': {
      anchor: 'facet-one-view-by-a-field',
      path: 'guides/faceting-and-composition',
    },
    'heatmap-labeled': {
      anchor: 'gradients-and-clipping',
      path: 'guides/themes-and-styling',
    },
    histogram: {
      anchor: 'inspect-frequency-with-a-histogram',
      path: 'examples/distributions',
    },
    'scatter-bubble': {
      anchor: 'complete-bubble-scatter-example',
      path: 'concepts/data-and-channels',
    },
  }
