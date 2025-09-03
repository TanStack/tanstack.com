import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const deleteFile = mutation({
  args: {
    projectId: v.id('forge_projects'),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('forge_projectFiles')
      .withIndex('by_projectId_path', (q) =>
        q.eq('projectId', args.projectId).eq('path', args.path)
      )
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})

export const updateFile = mutation({
  args: {
    projectId: v.id('forge_projects'),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('forge_projectFiles')
      .withIndex('by_projectId_path', (q) =>
        q.eq('projectId', args.projectId).eq('path', args.path)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
      })
      return
    }
    await ctx.db.insert('forge_projectFiles', {
      projectId: args.projectId,
      path: args.path,
      content: args.content,
    })
  },
})

export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert('forge_projects', {
      name: args.name,
      description: args.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    for (const file of args.files) {
      await ctx.db.insert('forge_projectFiles', {
        projectId,
        path: file.path,
        content: file.content,
      })
    }
    return projectId
  },
})

export const addChatMessages = mutation({
  args: {
    projectId: v.string(),
    messages: v.array(
      v.object({
        content: v.string(),
        messageId: v.string(),
        role: v.union(v.literal('user'), v.literal('assistant')),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete all existing messages for the project
    const messages = await ctx.db
      .query('forge_chatMessages')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
    for (const message of messages) {
      await ctx.db.delete(message._id)
    }

    // Add new messages
    for (const message of args.messages) {
      await ctx.db.insert('forge_chatMessages', {
        projectId: args.projectId,
        messageId: message.messageId,
        content: message.content,
        role: message.role,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  },
})

export const addChatMessage = mutation({
  args: {
    projectId: v.id('forge_projects'),
    content: v.string(),
    messageId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('forge_chatMessages', {
      projectId: args.projectId,
      messageId: args.messageId,
      content: args.content,
      role: args.role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const renameProject = mutation({
  args: { projectId: v.id('forge_projects'), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, { name: args.name })
  },
})

export const deleteProject = mutation({
  args: { projectId: v.id('forge_projects') },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (project) {
      await ctx.db.delete(project._id)
    }
    const files = await ctx.db
      .query('forge_projectFiles')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
    for (const file of files) {
      await ctx.db.delete(file._id)
    }
    const messages = await ctx.db
      .query('forge_chatMessages')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
    for (const message of messages) {
      await ctx.db.delete(message._id)
    }
  },
})

export const deleteChatMessages = mutation({
  args: { projectId: v.id('forge_projects') },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('forge_chatMessages')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
    for (const message of messages) {
      await ctx.db.delete(message._id)
    }
  },
})

export const getProjectFiles = query({
  args: { projectId: v.id('forge_projects') },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query('forge_projectFiles')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
    return files.map((file) => ({
      path: file.path,
      content: file.content,
    }))
  },
})

export const getChatMessages = query({
  args: { projectId: v.id('forge_projects') },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('forge_chatMessages')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
    return messages.map((message) => ({
      content: message.content,
      role: message.role,
      messageId: message.messageId,
    }))
  },
})

export const getProject = query({
  args: { projectId: v.id('forge_projects') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId)
  },
})

export const getProjects = query({
  handler: async (ctx) => {
    return await ctx.db.query('forge_projects').collect()
  },
})

export const getProjectDescription = query({
  args: { projectId: v.id('forge_projects') },
  handler: async (ctx, args) => {
    return (await ctx.db.get(args.projectId))?.description ?? ''
  },
})
