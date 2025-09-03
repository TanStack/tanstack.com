import { useState } from 'react'
import { useMutation } from 'convex/react'
import { Link, useRouter } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

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
      <div className="w-full md:w-64 bg-sidebar border-b md:border-b-0 md:border-r border-sidebar-border flex flex-col md:h-screen">
        <div className="p-4 border-b border-sidebar-border">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            Projects
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 max-h-32 md:max-h-none">
          {projects?.length === 0 && (
            <div className="text-center py-4 md:py-8">
              <p className="text-sidebar-foreground/60 text-sm">
                No projects yet
              </p>
            </div>
          )}
          {projects?.map((project) => (
            <div key={project._id} className="relative group">
              <div className="flex items-center justify-between">
                <Link
                  to="/forge/editor/$projectId"
                  params={{ projectId: project._id }}
                  className="flex-1 p-2 md:p-3 mb-1 md:mb-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm md:text-base"
                >
                  {project.name}
                </Link>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    onClick={() => toggleDropdown(project._id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {activeDropdown === project._id && (
                    <div className="absolute right-0 top-8 z-10 w-48 bg-background border border-border rounded-md shadow-lg">
                      <div className="py-1">
                        <button
                          onClick={() => handleRename(project)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(project)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
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
            >
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={!newProjectName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This
              action cannot be undone and will delete all project files and chat
              messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
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
