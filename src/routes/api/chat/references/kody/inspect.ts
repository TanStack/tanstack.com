import {createFileRoute} from '@tanstack/react-router'
import {handleReferenceCatalog} from '~/chat/server/reference-catalog-http.server'
export const Route=createFileRoute('/api/chat/references/kody/inspect')({server:{handlers:{GET:({request})=>handleReferenceCatalog(request,'kody-inspect')}}})
