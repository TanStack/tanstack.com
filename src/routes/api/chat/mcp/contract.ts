import {createFileRoute} from '@tanstack/react-router'
import {handleReferenceCatalog} from '~/chat/server/reference-catalog-http.server'
export const Route=createFileRoute('/api/chat/mcp/contract')({server:{handlers:{GET:({request})=>handleReferenceCatalog(request,'mcp-contract')}}})
