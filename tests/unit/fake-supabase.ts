type TableRows = Record<string, Array<Record<string, any>>>

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ilikeMatches(value: unknown, pattern: string) {
  const text = String(value ?? "")
  const regex = new RegExp(`^${pattern.split("%").map(escapeRegex).join(".*")}$`, "i")
  return regex.test(text)
}

class FakeQuery {
  private filters: Array<(row: Record<string, any>) => boolean> = []
  private orderFields: Array<{ field: string; ascending: boolean }> = []
  private limitCount: number | null = null

  constructor(
    private readonly rows: Array<Record<string, any>>,
    private readonly mutation?: (rows: Array<Record<string, any>>) => void
  ) {}

  select() {
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  in(field: string, values: unknown[]) {
    const set = new Set(values)
    this.filters.push((row) => set.has(row[field]))
    return this
  }

  contains(field: string, values: unknown[] | string) {
    const expectedValues = typeof values === "string" ? JSON.parse(values) as unknown[] : values
    this.filters.push((row) => {
      const current = row[field]
      if (!Array.isArray(current)) return false
      return expectedValues.every((value) => current.includes(value))
    })
    return this
  }

  is(field: string, value: unknown) {
    this.filters.push((row) => value === null ? row[field] == null : row[field] === value)
    return this
  }

  gt(field: string, value: unknown) {
    this.filters.push((row) => String(row[field] ?? "") > String(value ?? ""))
    return this
  }

  ilike(field: string, pattern: string) {
    this.filters.push((row) => ilikeMatches(row[field], pattern))
    return this
  }

  or(filter: string) {
    const predicates = filter.split(",").map((clause) => {
      const [field, operator, ...rest] = clause.split(".")
      const pattern = rest.join(".")
      if (!field || operator !== "ilike") return () => false
      return (row: Record<string, any>) => ilikeMatches(row[field], pattern)
    })

    this.filters.push((row) => predicates.some((predicate) => predicate(row)))
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderFields.push({ field, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  insert(payload: Record<string, any> | Array<Record<string, any>>) {
    const rows = Array.isArray(payload) ? payload : [payload]
    this.mutation?.(rows)
    return {
      select: () => ({
        single: async () => ({ data: rows[0] ?? null, error: null }),
      }),
    }
  }

  update(payload: Record<string, any>) {
    const matchingRows = this.resolve()
    for (const row of matchingRows) Object.assign(row, payload)
    return this
  }

  async maybeSingle() {
    return { data: this.resolve()[0] ?? null, error: null }
  }

  async single() {
    const data = this.resolve()[0] ?? null
    return { data, error: data ? null : { message: "No rows" } }
  }

  then<TResult1 = { data: Array<Record<string, any>>; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Array<Record<string, any>>; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve({ data: this.resolve(), error: null }).then(onfulfilled, onrejected)
  }

  private resolve() {
    let result = this.rows.filter((row) => this.filters.every((filter) => filter(row)))

    for (const { field, ascending } of [...this.orderFields].reverse()) {
      result = [...result].sort((a, b) => {
        const comparison = String(a[field] ?? "").localeCompare(String(b[field] ?? ""))
        return ascending ? comparison : -comparison
      })
    }

    return typeof this.limitCount === "number" ? result.slice(0, this.limitCount) : result
  }
}

export function createFakeSupabase(input: {
  tables?: TableRows
  rpcs?: Record<string, Array<Record<string, any>>>
}) {
  const tables = input.tables ?? {}
  const rpcs = input.rpcs ?? {}

  return {
    from(table: string) {
      if (!tables[table]) tables[table] = []
      return new FakeQuery(tables[table], (rows) => {
        tables[table].push(...rows)
      })
    },
    rpc(name: string) {
      return Promise.resolve({ data: rpcs[name] ?? [], error: null })
    },
  }
}
