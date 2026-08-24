export type WhiteboardType = 'beverages' | 'laundry'

export const WHITEBOARDS = {
  beverages: { emailLabel: 'Beverages', filename: 'beverages-whiteboard' },
  laundry: { emailLabel: 'Laundry', filename: 'laundry-whiteboard' },
} as const satisfies Record<WhiteboardType, { emailLabel: string; filename: string }>
