import * as React from 'react'
import { flag } from 'country-emoji'
import { IoIosClose } from 'react-icons/io'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'

export function PPPBanner() {
  const [hidden, setHidden] = useLocalStorage('pppbanner-hidden', false)
  const [data, setData] = useLocalStorage('pppbanner-data', null)

  React.useEffect(() => {
    // This function has CORS configured to allow
    // react-query.tanstack.com and tanstack.com
    if (!data) {
      fetch('https://ui.dev/api/ppp-discount')
        .then(res => res.json())
        .then(res => {
          if (res?.code) {
            setData(res)
          }
        })
    }
  }, [data, setData])

  if (!useClientOnlyRender()) {
    return null
  }

  return (
    <>
      {data && !hidden && (
        <div
          className="w-full bg-gradient-to-r from-red-500 to-amber-500 text-black text-sm text-center py-2 relative flex items-center justify-center"
        >
          {/* <p>
            <span className='scale-[2] inline-block relative top-[1px] mr-2'>{flag(data.code)}</span> We noticed you're in{' '}
            <strong>{data.country}.</strong> Get{' '}
            <strong>{data.discount * 100}% off</strong> the Official React Query
            Course with code {' '}
            <a
              className="underline cursor-pointer"
              href={`https://query.gg?from=tanstack&coupon_code=${data.coupon}`}
            >
              <strong>{data.coupon}</strong>
            </a>
            .
          </p> */}
          <p>
            Want to master React Query?{' '}
            <a href="https://query.gg?from=tanstack&coupon_code=${data.coupon}">
              <strong>Sign up for offical course updates</strong>
            </a>{' '}
            to get{' '}
            <strong>{data.discount * 100}% off</strong> off when it launches
            <span className='scale-[2] inline-block relative top-[1px] ml-3'>{flag(data.code)}</span>
          </p>
          <button
            onClick={() => setHidden(true)}
            className="absolute right-0"
            aria-label="Hide Banner"
          >
            <IoIosClose size={30} className="text-black" />
          </button>
        </div>
      )}
    </>
  )
}