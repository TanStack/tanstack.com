import {createFileRoute} from '@tanstack/react-router'
import {handleDeviceAccount} from '~/chat/server/device-http.server'
export const Route=createFileRoute('/api/chat/account/devices')({server:{handlers:{GET:({request})=>handleDeviceAccount(request),POST:({request})=>handleDeviceAccount(request)}}})
