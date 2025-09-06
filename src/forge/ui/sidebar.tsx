import { useState } from 'react'
import { useMutation } from 'convex/react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Code2,
  Plus,
  Home,
  Sparkles,
  Clock,
  ChevronRight,
} from 'lucide-react'

import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

type Project = {
  _id: string
  name: string
  createdAt: number
  updatedAt: number
}

type SidebarProps = {
  projects: Array<Project> | undefined
}

export default function Sidebar({ projects }: SidebarProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const router = useRouter()
  const renameProject = useMutation(api.forge.renameProject)
  const deleteProject = useMutation(api.forge.deleteProject)

  const handleRename = (project: Project) => {
    setSelectedProject(project)
    setNewProjectName(project.name)
    setRenameDialogOpen(true)
    setActiveDropdown(null)
  }

  const handleDelete = (project: Project) => {
    setSelectedProject(project)
    setDeleteDialogOpen(true)
    setActiveDropdown(null)
  }

  const confirmRename = async () => {
    if (selectedProject && newProjectName.trim()) {
      await renameProject({
        projectId: selectedProject._id as Id<'forge_projects'>,
        name: newProjectName.trim(),
      })
      setRenameDialogOpen(false)
      setSelectedProject(null)
      setNewProjectName('')
    }
  }

  const confirmDelete = async () => {
    if (selectedProject) {
      await deleteProject({
        projectId: selectedProject._id as Id<'forge_projects'>,
      })
      setDeleteDialogOpen(false)
      setSelectedProject(null)

      // Navigate to home if we're currently viewing the deleted project
      const currentPath = window.location.pathname
      if (currentPath.includes(selectedProject._id)) {
        router.navigate({ to: '/' })
      }
    }
  }

  const toggleDropdown = (projectId: string) => {
    setActiveDropdown(activeDropdown === projectId ? null : projectId)
  }

  return (
    <>
      <div className="w-full md:w-80 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col md:h-screen">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">TanStack Forge</h2>
              <p className="text-xs text-slate-400">AI Development Studio</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-1">
            <Link
              to="/forge"
              className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors [&.active]:bg-blue-500/10 [&.active]:text-blue-400"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>

        {/* Projects Section */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Projects ({projects?.length || 0})
              </h3>
              <Link
                to="/forge"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                title="New Project"
              >
                <Plus className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-2">
              {projects?.length === 0 && (
                <div className="text-center py-8">
                  <div className="p-3 bg-slate-800/50 rounded-xl mb-3 inline-block">
                    <Code2 className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-500 text-sm mb-4">No projects yet</p>
                  <Link
                    to="/forge"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Project
                  </Link>
                </div>
              )}

              {projects?.map((project) => (
                <div key={project._id} className="relative group">
                  <Link
                    to="/forge/editor/$projectId"
                    params={{ projectId: project._id }}
                    className="flex items-center gap-3 p-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-200 group"
                  >
                    <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                      <Code2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {project.name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </Link>

                  {/* Options Menu */}
                  <div className="absolute right-2 top-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 hover:bg-slate-700"
                      onClick={(e) => {
                        e.preventDefault()
                        toggleDropdown(project._id)
                      }}
                    >
                      <MoreHorizontal className="h-3 w-3 text-slate-400" />
                    </Button>

                    {activeDropdown === project._id && (
                      <div className="absolute right-0 top-8 z-10 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                        <div className="py-1">
                          <button
                            onClick={() => handleRename(project)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                            Rename Project
                          </button>
                          <button
                            onClick={() => handleDelete(project)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Project
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800">
          <div className="text-xs text-slate-500 text-center">
            Powered by AI • Built with ❤️
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Project</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirmRename()
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRename}
              disabled={!newProjectName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Project</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete "{selectedProject?.name}"? This
              action cannot be undone and will delete all project files and chat
              messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Click outside to close dropdown */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </>
  )
}
