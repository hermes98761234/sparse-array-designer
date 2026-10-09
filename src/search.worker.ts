import { branchAndBound, heuristicGolomb } from './lib/golomb'
import { exactSparse } from './lib/sparse'

export type SearchRequest =
  | { kind: 'golomb-exact'; n: number }
  | { kind: 'golomb-heuristic'; n: number; ms: number }
  | { kind: 'sparse-exact'; length: number }

export type SearchMessage =
  | { type: 'progress'; nodes: number; length?: number }
  | { type: 'done'; marks: number[]; nodes?: number; ms: number }

const post = (m: SearchMessage) => postMessage(m)

onmessage = (e: MessageEvent<SearchRequest>) => {
  const req = e.data
  const t0 = Date.now()
  if (req.kind === 'golomb-exact') {
    const r = branchAndBound(req.n, {
      onProgress: ({ nodes, length }) => {
        post({ type: 'progress', nodes, length })
      },
    })
    post({ type: 'done', marks: r?.marks ?? [], nodes: r?.nodes, ms: Date.now() - t0 })
  } else if (req.kind === 'golomb-heuristic') {
    const r = heuristicGolomb(req.n, req.ms, 1, Date.now, false)
    post({ type: 'done', marks: r.marks, ms: Date.now() - t0 })
  } else {
    post({ type: 'done', marks: exactSparse(req.length) ?? [], ms: Date.now() - t0 })
  }
}
