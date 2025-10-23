import { ConvexHttpClient } from 'convex/browser'
import { createServerFn, createMiddleware } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import { api } from 'convex/_generated/api'

export const authMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  const sessionToken = await getCookie('better-auth.convex_jwt')
  return await next({
    context: {
      sessionToken,
    },
  })
})

export const getChatMessages = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .inputValidator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    convex.setAuth(ctx.context.sessionToken!)
    const chatMessages = await convex.query(api.forge.getChatMessages, {
      projectId,
    })
    return chatMessages
  })

export const getProjectFiles = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .inputValidator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    convex.setAuth(ctx.context.sessionToken!)
    const projectFiles = await convex.query(api.forge.getProjectFiles, {
      projectId,
    })
    return projectFiles
  })

export const getProjectDescription = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .inputValidator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    convex.setAuth(ctx.context.sessionToken!)
    const projectDescription = await convex.query(
      api.forge.getProjectDescription,
      {
        projectId,
      }
    )
    return projectDescription
  })

export const getProjectData = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .inputValidator(({ projectId }) => ({
    projectId,
  }))
  .handler(async (ctx) => {
    const { projectId } = ctx.data
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!)
    convex.setAuth(ctx.context.sessionToken!)
    const projectData = await convex.query(api.forge.getProject, {
      projectId,
    })
    return projectData
  })
