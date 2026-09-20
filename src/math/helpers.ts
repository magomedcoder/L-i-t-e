export const pairs = <T, R>(lst: T[], fn: (a: T, b: T, i: number) => R): R[] => lst.slice(0, -1).map((x, i) => fn(x, lst[i + 1], i))

export const transpose = <T>(mat: T[][]): T[][] => mat[0].map((_, i) => mat.map((row) => row[i]))

export const range = (N: number, a = 0): number[] => Array(N).fill(0).map((_, x) => x + a)

export const reshape = <T>(A: T[], m: number): T[][] => range(A.length / m).map((x) => A.slice(x * m, (x + 1) * m))

export const urandom = (): number => Math.random() * 2 - 1

export const cartesianProductMap = <A, B, R>(a: A[], b: B[], f: (x: A, y: B) => R): R[] => ([] as R[]).concat(...a.map((x) => b.map((y) => f(x, y))))

export const push = <T>(x: T[], y: T): T[] => (x.push(y), x)

export const clamp = (x: number, low: number, high: number): number => Math.min(Math.max(low, x), high)

export const sum = (x: number[]): number => x.reduce((a, b) => a + b, 0)
