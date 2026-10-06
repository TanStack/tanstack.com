import {createFileRoute} from '@tanstack/react-router'
import {handleReferenceCatalog} from '~/chat/server/reference-catalog-http.server'
export const Route=createFileRoute('/api/chat/references/tools/refresh')({server:{handlers:{POST:({request})=>handleReferenceCatalog(request,'tools-refresh')}}})
