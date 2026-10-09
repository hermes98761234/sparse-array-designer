import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchMessage, SearchRequest } from './search.worker'

export interface SearchState {
  running: boolean
  nodes: number
  /** length currently being tried by the exact Golomb search */
  length?: number
}

/** Runs one search at a time in a Web Worker; cancel() terminates it. */
export function useSearch(onDone: (req: SearchRequest, marks: number[], ms: number) => void) {
  const worker = useRef<Worker | null>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  const [state, setState] = useState<SearchState>({ running: false, nodes: 0 })

  const cancel = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
    setState({ running: false, nodes: 0 })
  }, [])

  const run = useCallback(
    (req: SearchRequest) => {
      worker.current?.terminate()
      const w = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' })
      worker.current = w
      setState({ running: true, nodes: 0 })
      w.onmessage = (e: MessageEvent<SearchMessage>) => {
        const m = e.data
        if (m.type === 'progress') setState({ running: true, nodes: m.nodes, length: m.length })
        else {
          w.terminate()
          worker.current = null
          setState({ running: false, nodes: 0 })
          if (m.marks.length) done.current(req, m.marks, m.ms)
        }
      }
    },
    [],
  )

  useEffect(() => () => worker.current?.terminate(), [])
  return { state, run, cancel }
}
