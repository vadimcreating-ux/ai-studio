import { randomUUID } from 'node:crypto'

export type FileItem = {
  id: string
  taskId: string
  type: 'image'
  name: string
  url: string
  createdAt: string
  source: 'kie'
}

const files: FileItem[] = []

export function saveImageToFiles(data: {
  taskId: string
  url: string
}) {
  const existing = files.find((file) => file.taskId === data.taskId)
  if (existing) return existing

  const item: FileItem = {
    id: randomUUID(),
    taskId: data.taskId,
    type: 'image',
    name: `image-${Date.now()}.png`,
    url: data.url,
    createdAt: new Date().toISOString(),
    source: 'kie',
  }

  files.unshift(item)
  return item
}

export function getFiles() {
  return files
}
