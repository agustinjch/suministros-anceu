import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ZONES, type Product } from './lib/types'
import products from './products.json'

const catalog = products as Product[]

describe('products.json', () => {
  it('tiene 47 productos sin ids repetidos', () => {
    expect(catalog).toHaveLength(47)
    expect(new Set(catalog.map((p) => p.id)).size).toBe(47)
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
