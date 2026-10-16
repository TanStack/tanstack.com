import {createFileRoute} from '@tanstack/react-router'
import {handleDeviceTransport} from '~/chat/server/device-http.server'
export const Route=createFileRoute('/api/chat/device-transport')({server:{handlers:{POST:({request})=>handleDeviceTransport(request)}}})
