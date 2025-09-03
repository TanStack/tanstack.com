import { ConvexHttpClient } from 'convex/browser'
import { createServerFn } from '@tanstack/react-start'

import { api } from 'convex/_generated/api'

export const getChatMessages = createServerFn({
  method: 'GET',
})
  .validator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    const chatMessages = await convex.query(api.forge.getChatMessages, {
      projectId,
    })
    return chatMessages
  })

export const getProjectFiles = createServerFn({
  method: 'GET',
})
  .validator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    const projectFiles = await convex.query(api.forge.getProjectFiles, {
      projectId,
    })
    return projectFiles
  })

export const getProjectDescription = createServerFn({
  method: 'GET',
})
  .validator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    const projectDescription = await convex.query(
      api.forge.getProjectDescription,
      {
        projectId,
      }
    )
    return projectDescription
  })
