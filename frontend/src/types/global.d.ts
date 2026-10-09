declare namespace JSX {
  interface IntrinsicElements {
    svg: React.DetailedHTMLProps<React.SVGProps<SVGSVGElement>, SVGSVGElement>;
    path: React.DetailedHTMLProps<React.SVGProps<SVGPathElement>, SVGPathElement>;
    circle: React.DetailedHTMLProps<React.SVGProps<SVGCircleElement>, SVGCircleElement>;
    line: React.DetailedHTMLProps<React.SVGProps<SVGLineElement>, SVGLineElement>;
    rect: React.DetailedHTMLProps<React.SVGProps<SVGRectElement>, SVGRectElement>;
    g: React.DetailedHTMLProps<React.SVGProps<SVGGElement>, SVGGElement>;
    text: React.DetailedHTMLProps<React.SVGProps<SVGTextElement>, SVGTextElement>;
    polygon: React.DetailedHTMLProps<React.SVGProps<SVGPolygonElement>, SVGPolygonElement>;
    polyline: React.DetailedHTMLProps<React.SVGProps<SVGPolyLineElement>, SVGPolyLineElement>;
    defs: React.DetailedHTMLProps<React.SVGProps<SVGDefsElement>, SVGDefsElement>;
    use: React.DetailedHTMLProps<React.SVGProps<SVGUseElement>, SVGUseElement>;
    symbol: React.DetailedHTMLProps<React.SVGProps<SVGSymbolElement>, SVGSymbolElement>;
  }
}