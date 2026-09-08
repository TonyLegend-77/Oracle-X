"use client";

import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, SimulationNodeDatum } from "d3-force";
import { select } from "d3-selection";
import { drag } from "d3-drag";
import { zoom } from "d3-zoom";
import { MarketMapData } from "@/lib/api";

type Node = SimulationNodeDatum & {
  id: number;
  symbol: string;
  sector: string | null;
  change_pct: number;
  radius: number;
};

type Edge = {
  source: number | Node;
  target: number | Node;
  correlation: number;
};

const SECTOR_COLOR: Record<string, string> = {
  semiconductors: "#E8A33D",
  big_tech: "#8B93A7",
  auto_tech: "#4FD1C5",
  media_tech: "#8B93A7",
  crypto_equity: "#F0554C",
  software: "#8B93A7",
  crypto: "#4FD1C5",
  index: "#565E6D",
};

export default function MarketMap({ data, activePath }: { data: MarketMapData; activePath?: number[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const resize = () => setDimensions({ width: el.clientWidth, height: el.clientHeight });
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const { width, height } = dimensions;

    const nodes: Node[] = data.nodes.map((n) => ({
      ...n,
      radius: 10 + Math.min(Math.abs(n.change_pct) * 200, 18),
    }));
    const edges: Edge[] = data.edges
      .filter((e) => Math.abs(e.correlation) > 0.25)
      .map((e) => ({ source: e.source, target: e.target, correlation: e.correlation }));

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    svg.call(
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 2.5])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const simulation = forceSimulation<Node>(nodes)
      .force(
        "link",
        forceLink<Node, Edge>(edges as any)
          .id((d: any) => d.id)
          .distance((d: any) => 140 - Math.abs(d.correlation) * 80)
          .strength((d: any) => Math.abs(d.correlation) * 0.6)
      )
      .force("charge", forceManyBody().strength(-220))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide<Node>((d) => d.radius + 14));

    const link = g
      .append("g")
      .selectAll<SVGLineElement, Edge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => (d.correlation >= 0 ? "#4FD1C5" : "#F0554C"))
      .attr("stroke-opacity", (d) => 0.15 + Math.abs(d.correlation) * 0.35)
      .attr("stroke-width", (d) => 0.5 + Math.abs(d.correlation) * 2);

    const node = g
      .append("g")
      .selectAll<SVGGElement, Node>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "grab")
      .call(
        drag<SVGGElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.2).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", "#14171C")
      .attr("stroke", (d) => SECTOR_COLOR[d.sector ?? ""] ?? "#565E6D")
      .attr("stroke-width", (d) => (activePath?.includes(d.id) ? 2.5 : 1.5));

    node
      .append("circle")
      .attr("r", 3)
      .attr("fill", (d) => (d.change_pct >= 0 ? "#4FD1C5" : "#F0554C"));

    node
      .append("text")
      .text((d) => d.symbol)
      .attr("x", 0)
      .attr("y", (d) => d.radius + 14)
      .attr("text-anchor", "middle")
      .attr("fill", "#E8EAED")
      .attr("font-family", "var(--font-plex-mono)")
      .attr("font-size", 11);

    node
      .append("text")
      .text((d) => `${d.change_pct >= 0 ? "+" : ""}${(d.change_pct * 100).toFixed(1)}%`)
      .attr("x", 0)
      .attr("y", (d) => d.radius + 27)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d.change_pct >= 0 ? "#4FD1C5" : "#F0554C"))
      .attr("font-family", "var(--font-plex-mono)")
      .attr("font-size", 10);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, activePath]);

  return (
    <div className="relative h-full w-full">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-4 left-4 flex gap-4 text-data-sm text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 bg-long/60" /> positive correlation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 bg-short/60" /> negative correlation
        </span>
      </div>
    </div>
  );
}
