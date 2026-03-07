import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { cn } from '../lib/utils';

const TimelineChart = ({
  data = [],
  width = '100%',
  height = 300,
  margin = { top: 20, right: 30, bottom: 30, left: 40 },
  className = '',
  onEventClick,
}) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Set up dimensions
    const svg = d3.select(svgRef.current);
    const svgWidth = svg.node().getBoundingClientRect().width;
    const innerWidth = svgWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Parse dates
    const parseTime = d3.timeParse('%Y-%m-%d');
    const dataWithDates = data.map(d => ({
      ...d,
      date: d.date instanceof Date ? d.date : parseTime(d.date) || new Date(d.date)
    }));

    // Sort data by date
    dataWithDates.sort((a, b) => a.date - b.date);

    // Set up scales
    const x = d3.scaleTime()
      .domain(d3.extent(dataWithDates, d => d.date))
      .range([0, innerWidth])
      .nice();

    // Set up y-scale for event distribution
    const y = d3.scaleLinear()
      .domain([0, d3.max(dataWithDates, d => d.value || 1) * 1.1])
      .range([innerHeight, 0]);

    // Create chart group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add x-axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat(d3.timeFormat('%b %Y'))
      .tickSizeOuter(0));

    // Add y-axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat('')
        .tickSizeOuter(0));

    // Add line
    const line = d3.line()
      .x(d => x(d.date))
      .y(d => y(d.value || 0))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dataWithDates)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 2);

    // Add dots for each data point
    const dots = g.selectAll('.dot')
      .data(dataWithDates)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.value || 0))
      .attr('r', 5)
      .attr('fill', 'currentColor')
      .on('mouseover', (event, d) => {
        d3.select(tooltipRef.current)
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
        
        d3.select(tooltipRef.current).select('.tooltip-title')
          .text(d.title || 'Event');
        
        d3.select(tooltipRef.current).select('.tooltip-date')
          .text(d3.timeFormat('%B %d, %Y')(d.date));
        
        if (d.description) {
          d3.select(tooltipRef.current).select('.tooltip-desc')
            .text(d.description)
            .style('display', 'block');
        } else {
          d3.select(tooltipRef.current).select('.tooltip-desc')
            .style('display', 'none');
        }
      })
      .on('mouseout', () => {
        d3.select(tooltipRef.current).style('opacity', 0);
      })
      .on('click', (event, d) => {
        if (onEventClick) onEventClick(d);
      });

    // Add brush for zooming
    const brush = d3.brushX()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on('end', brushed);

    const zoom = g.append('g')
      .attr('class', 'brush')
      .call(brush);

    function brushed(event) {
      if (!event.selection) return;
      const [x0, x1] = event.selection.map(x.invert, x);
      
      // Update x-scale domain based on brush selection
      x.domain([x0, x1]);
      
      // Update x-axis
      svg.select('.x-axis').call(d3.axisBottom(x).tickFormat(d3.timeFormat('%b %Y')));
      
      // Update line
      svg.select('.line')
        .attr('d', line);
        
      // Update dots
      svg.selectAll('.dot')
        .attr('cx', d => x(d.date));
    }

    // Cleanup
    return () => {
      d3.select(svgRef.current).selectAll('*').remove();
    };
  }, [data, height, margin, onEventClick]);

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full text-primary"
      >
        <style jsx>{`
          .grid line {
            stroke: #e5e7eb;
            stroke-opacity: 0.7;
            shape-rendering: crispEdges;
          }
          .grid path {
            stroke-width: 0;
          }
          .dot {
            cursor: pointer;
            transition: r 0.2s;
          }
          .dot:hover {
            r: 8;
          }
          .line {
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          .brush .selection {
            fill: #3b82f6;
            fill-opacity: 0.1;
            stroke: #3b82f6;
            stroke-width: 1px;
            stroke-dasharray: 3, 3;
          }
        `}</style>
      </svg>
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-10 p-3 bg-white border rounded shadow-lg pointer-events-none opacity-0 transition-opacity duration-200 text-sm max-w-xs"
      >
        <div className="font-semibold tooltip-title"></div>
        <div className="text-xs text-gray-500 tooltip-date"></div>
        <div className="mt-1 text-gray-700 tooltip-desc"></div>
      </div>
    </div>
  );
};

export default TimelineChart;
