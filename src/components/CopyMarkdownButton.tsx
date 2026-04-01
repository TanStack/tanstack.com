'use client'
import { useState, useTransition } from 'react'

import { type MouseEventHandler, useEffect, useRef } from 'react'
import { useToast } from '~/components/ToastProvider'
import { Check, Copy } from 'lucide-react'
import { Button } from '~/ui'

export function useCopyButton(
  onCopy: () => void | Promise<void>,
): [checked: boolean, onClick: MouseEventHandler] {
  const [checked, setChecked] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const onClick: MouseEventHandler = async () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    const res = Promise.resolve(onCopy())

    void res.then(() => {
      setChecked(true)
      timeoutRef.current = window.setTimeout(() => {
        setChecked(false)
      }, 1500)
    })
  }

  // avoid updates after being unmounted
  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return [checked, onClick]
}
