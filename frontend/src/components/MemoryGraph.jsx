import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { cn } from '../lib/utils';
import { ZoomIn, ZoomOut, RefreshCw, Maximize } from 'lucide-react';

const MemoryGraph = ({
  data = {},
  width = '100%',
  height = 500,
  margin = { top: 20, right: 20, bottom: 30, left: 40 },
  className = '',
  onNodeClick,
  onNodeDblClick,
  onLinkClick,
}) => {
  const svgRef = useRef();
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const { width: svgWidth, height: svgHeight } = svgRef.current.getBoundingClientRect();
        setDimensions({
          width: svgWidth - margin.left - margin.right,
          height: svgHeight - margin.top - margin.bottom
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [margin.top, margin.right, margin.bottom, margin.left]);

  useEffect(() => {
    if (dimensions.width === 0) return;

    // Clone data to avoid mutating props with D3
    const nodes = data.nodes ? data.nodes.map(n => ({ ...n })) : [];
    const links = (data.links || data.edges || []).map(l => ({ ...l }));

    if (nodes.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    const { width: innerWidth, height: innerHeight } = dimensions;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${innerWidth + margin.left + margin.right} ${innerHeight + margin.top + margin.bottom}`)
      .attr('style', 'max-width: 100%; height: auto; outline: none;');

    // Define arrow markers for directed links
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20) // Position based on node radius
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    // Create main group with margins
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collide', d3.forceCollide().radius(45).iterations(2));

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTransform(event.transform);
      });

    svg.call(zoom);

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', '#cbd5e1') // slate-300
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.max(1, Math.sqrt(d.strength || 1) * 2))
      .attr('marker-end', 'url(#arrowhead)');

    // Create node groups
    const node = g.append('g')
      .selectAll('.node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node cursor-pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        if (onNodeClick) onNodeClick(d);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if (onNodeDblClick) onNodeDblClick(d);
      });

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => Math.max(12, Math.min(30, 8 + (d.size || 0) * 2)))
      .attr('fill', d => getNodeColor(d.group || d.type || 'default'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('class', 'transition-all duration-200 hover:stroke-slate-400');

    // Add labels to nodes (truncated)
    node.append('text')
      .attr('dy', '1.8em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#475569') // slate-600
      .style('font-size', '10px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.8)')
      .text(d => {
        const label = d.title || d.content || d.id;
        return label.length > 15 ? `${label.substring(0, 15)}...` : label;
      });

    // Add titles (tooltips)
    node.append('title')
      .text(d => `${d.type || 'Fragment'}: ${d.content || d.id}\nScore: ${d.score || 'N/A'}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Initial zoom to fit
    const zoomToFit = () => {
      if (!svgRef.current) return;
      const bounds = svgRef.current.getBBox(); // Access bounding box
      if (bounds.width === 0 || bounds.height === 0) return;

      const fullWidth = bounds.width + margin.left + margin.right;
      const fullHeight = bounds.height + margin.top + margin.bottom;
      const widthRatio = innerWidth / fullWidth;
      const heightRatio = innerHeight / fullHeight;
      const scale = 0.8 * Math.min(widthRatio, heightRatio); // 0.8 for padding using min ratio

      // Center calculation
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      const translate = [
        innerWidth / 2 - scale * centerX, // Center in viewport
        innerHeight / 2 - scale * centerY
      ];

      svg.transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale)
        );
    };

    // Initial zoom to fit after simulation settles slightly
    setTimeout(zoomToFit, 300);
    setIsLoading(false);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, dimensions, margin, onNodeClick]);

  // Helper function to get node color based on type/group
  // Generating deterministic color from string hash for groups
  const getNodeColor = (type) => {
    const colors = {
      document: '#3b82f6',    // blue-500
      concept: '#10b981',     // emerald-500
      person: '#8b5cf6',      // violet-500
      organization: '#ec4899', // pink-500
      location: '#f59e0b',    // amber-500
      default: '#6b7280',      // gray-500
      // Specific topic mappings can be added here
      'science': '#06b6d4', // cyan
      'history': '#d946ef', // fuchsia
    };

    if (colors[type.toLowerCase()]) return colors[type.toLowerCase()];

    // Generate color from string hash for unknown groups
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };

  // Handle zoom controls
  const zoomIn = () => {
    d3.select(svgRef.current)
      .transition()
      .call(d3.zoom().scaleBy, 1.5);
  };

  const zoomOut = () => {
    d3.select(svgRef.current)
      .transition()
      .call(d3.zoom().scaleBy, 0.75);
  };

  const resetZoom = () => {
    d3.select(svgRef.current)
      .transition()
      .duration(750)
      .call(d3.zoom().transform, d3.zoomIdentity);
  };

  return (
    <div className={cn('relative w-full h-full bg-slate-50 dark:bg-slate-900 rounded-lg border overflow-hidden', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="w-full h-full min-h-[400px] touch-none"
      >
        <style jsx>{`
          .node circle {
            transition: all 0.3s ease;
          }
          .node:hover circle {
            stroke: #3b82f6;
            stroke-width: 3px;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
          }
          .link {
            transition: stroke-width 0.2s;
          }
        `}</style>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <button
          onClick={zoomIn}
          className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4 text-slate-700 dark:text-slate-200" />
        </button>
        <button
          onClick={zoomOut}
          className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4 text-slate-700 dark:text-slate-200" />
        </button>
        <button
          onClick={resetZoom}
          className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Reset View"
        >
          <RefreshCw className="h-4 w-4 text-slate-700 dark:text-slate-200" />
        </button>
      </div>

      {/* Info Badge */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-sm border text-xs text-slate-500">
        {data.nodes ? `${data.nodes.length} nodes · ${(data.links || data.edges || []).length} connections` : 'No data'}
      </div>
    </div>
  );
};

export default MemoryGraph;
