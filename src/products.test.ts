import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ZONES, type Product } from './lib/types'
import products from './products.json'

const catalog = products as Product[]

describe('products.json', () => {
  it('tiene 50 productos sin ids repetidos', () => {
    expect(catalog).toHaveLength(50)
    expect(new Set(catalog.map((p) => p.id)).size).toBe(50)
  })

  it('sigue el recorrido físico acordado sin obligar a volver atrás', () => {
    expect(catalog.map((p) => p.id)).toEqual([
      2565, 56093, 48857, 20124, 22699, 23085, 38910, 45271, 2283, 4976,
      4975, 15086, 40240, 51629, 54375, 18973,
      38762, 57172, 45113, 69042, 79223, 27895, 21716, 4598,
      10360, 41183, 50152, 50154, 1827, 1924, 51190, 15592,
      21162, 3694, 5406, 2527, 7292, 9753, 9106, 7670, 37283,
      45365, 45372, 68507, 44312,
      5014, 5034, 23977, 46677, 58871,
    ])
  })

  it('usa referencias vigentes para aluminio y bolsas de basura de 10 L', () => {
    expect(catalog.find((p) => p.name === 'Papel de horno')).toMatchObject({
      id: 21162,
      froiz_url: 'https://supermercado.froiz.com/product/21162-papel-albal-hornos-8-m',
    })
    expect(catalog.find((p) => p.name === 'Papel de aluminio')).toMatchObject({
      id: 3694,
      froiz_url: 'https://supermercado.froiz.com/product/3694-papel-aluminio-froiz-reforzado-20-m',
    })
    expect(catalog.find((p) => p.id === 69042)).toMatchObject({
      name: 'Bolsas de basura perfumadas 10 L',
      target: 2,
      unit: 'ud',
      location: 'despensa',
    })
  })

  it('todos los campos estan rellenos', () => {
    for (const p of catalog) {
      expect(p.name, String(p.id)).toBeTruthy()
      expect(p.name_en, String(p.id)).toBeTruthy()
      expect(p.froiz_name, String(p.id)).toBeTruthy()
      expect(p.froiz_url, String(p.id)).toMatch(/^https:\/\/supermercado\.froiz\.com\/product\//)
      expect(p.image, String(p.id)).toBe(`/img/${p.id}.jpg`)
      expect(p.target, String(p.id)).toBeGreaterThan(0)
      expect(ZONES, String(p.id)).toContain(p.location)
    }
  })

  it('las urls no arrastran el # que traia el sheet', () => {
    for (const p of catalog) {
      expect(p.froiz_url, String(p.id)).not.toContain('#')
    }
  })

  it('cada producto tiene su foto descargada en el repo', () => {
    for (const p of catalog) {
      const path = new URL(`../public/img/${p.id}.jpg`, import.meta.url)
      expect(existsSync(path), `falta la foto de ${p.id} ${p.name}`).toBe(true)
    }
  })
})
