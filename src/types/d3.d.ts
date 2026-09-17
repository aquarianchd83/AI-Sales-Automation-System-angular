// mermaid's published typings import `Selection` and `CurveFactory` from 'd3', but mermaid doesn't
// depend on @types/d3. Nothing in the app uses d3 directly, so loose stand-ins are enough.
declare module 'd3' {
  export type Selection<GElement = any, Datum = any, PElement = any, PDatum = any> = any;
  export type CurveFactory = any;
}
