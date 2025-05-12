import BytesForm from '~/components/BytesForm'

export function DocsCalloutBytes(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <div className="space-y-4" {...props}>
      <div className="space-y-1 md:space-y-2">
        <h6 className="text-[.8rem] uppercase font-black opacity-50">
          Subscribe to Bytes
        </h6>
        <p className="text-xs md:text-xs">
          Your weekly dose of JavaScript news. Delivered every Monday to over
          100,000 devs, for free.
        </p>
      </div>
      <BytesForm />
    </div>
  )
}
