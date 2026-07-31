import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ZONES, type Unit } from '../src/lib/types'

const UNITS: Unit[] = ['ud', 'pack', 'bolsa', 'kg']

const rows = readFileSync(new URL('./seed.tsv', import.meta.url), 'utf8')
  .trim()
  .split('\n')

const header = rows[0].split('\t')
const data = rows.slice(1).map((line) => {
  const [id, zone, target, unit, name, name_en] = line.split('\t')
  return { id, zone, target, unit, name, name_en }
})

describe('seed.tsv', () => {
  it('tiene la cabecera esperada', () => {
    expect(header).toEqual(['id', 'zone', 'target', 'unit', 'name', 'name_en'])
  })

  it('tiene 46 productos', () => {
    expect(data).toHaveLength(46)
  })

  it('no repite ids', () => {
    const ids = data.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todas las filas estan completas', () => {
    for (const row of data) {
      for (const [key, value] of Object.entries(row)) {
        expect(value, `${row.id} ${key}`).toBeTruthy()
      }
    }
  })

  it('usa solo zonas y unidades conocidas', () => {
    for (const row of data) {
      expect(ZONES, row.id).toContain(row.zone)
      expect(UNITS, row.id).toContain(row.unit)
    }
  })

  it('los objetivos son enteros positivos', () => {
    for (const row of data) {
      const target = Number(row.target)
      expect(Number.isInteger(target), row.id).toBe(true)
      expect(target, row.id).toBeGreaterThan(0)
    }
  })

  it('agrupa las zonas en el orden de recorrido de la casa', () => {
    const seen: string[] = []
    for (const row of data) {
      if (seen[seen.length - 1] !== row.zone) seen.push(row.zone)
    }
    // Cada zona aparece en un unico bloque contiguo, en el orden de ZONES.
    expect(seen).toEqual([...ZONES])
  })

  it('no deja parentesis de formato del sheet en los nombres', () => {
    for (const row of data) {
      expect(row.name, row.id).not.toMatch(/\(\s*(unit|bag)\s*\)/i)
      expect(row.name, row.id).not.toContain(' / ')
    }
  })
})
