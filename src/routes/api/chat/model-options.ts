import {createFileRoute} from '@tanstack/react-router'
import {handleModelOptions} from '~/chat/server/model-options-http.server'
export const Route=createFileRoute('/api/chat/model-options')({server:{handlers:{GET:({request})=>handleModelOptions(request)}}})
