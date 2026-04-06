/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebGL 节点数阈值，超过此值使用 WebGL 渲染 */
  readonly VITE_WEBGL_NODE_THRESHOLD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
