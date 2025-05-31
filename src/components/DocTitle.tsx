export function DocTitle(props: { children: React.ReactNode }) {
  return (
    <>
      <h1
        className={`flex flex-wrap items-center gap-4 text-xl font-black md:text-2xl`}
      >
        {props.children}
      </h1>
    </>
  )
}
