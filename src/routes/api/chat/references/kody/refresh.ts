import {createFileRoute} from '@tanstack/react-router'
import {handleReferenceCatalog} from '~/chat/server/reference-catalog-http.server'
export const Route=createFileRoute('/api/chat/references/kody/refresh')({server:{handlers:{POST:({request})=>handleReferenceCatalog(request,'kody-refresh')}}})
