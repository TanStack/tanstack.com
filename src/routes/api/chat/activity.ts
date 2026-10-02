import {createFileRoute} from '@tanstack/react-router'
import {handleWorkspaceActivity} from '~/chat/server/workspace-activity-http.server'
export const Route=createFileRoute('/api/chat/activity')({server:{handlers:{GET:({request})=>handleWorkspaceActivity(request)}}})
