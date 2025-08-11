import { seo } from '~/utils/seo'
import { Footer } from '~/components/Footer'

export const Route = createFileRoute({
  component: BuilderComponent,
  head: () => ({
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
})

function BuilderComponent() {
  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-3px) translateX(1px) rotate(1deg);
          }
          50% {
            transform: translateY(1px) translateX(-1px) rotate(-1deg);
          }
          75% {
            transform: translateY(-2px) translateX(-1px) rotate(0.5deg);
          }
        }
        @keyframes hueShift {
          0% {
            filter: hue-rotate(0deg) saturate(1.5) brightness(1.1);
          }
          25% {
            filter: hue-rotate(45deg) saturate(1.5) brightness(1.1);
          }
          50% {
            filter: hue-rotate(180deg) saturate(1.5) brightness(1.1);
          }
          75% {
            filter: hue-rotate(270deg) saturate(1.5) brightness(1.1);
          }
          100% {
            filter: hue-rotate(360deg) saturate(1.5) brightness(1.1);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes orbitReflection {
          0% {
            transform: rotate(0deg) translateX(0) translateY(0);
            opacity: 0.6;
            z-index: 10;
          }
          25% {
            transform: rotate(90deg) translateX(10px) translateY(0);
            opacity: 0.3;
            z-index: -1;
          }
          50% {
            transform: rotate(180deg) translateX(0) translateY(0);
            opacity: 0.2;
            z-index: -1;
          }
          75% {
            transform: rotate(270deg) translateX(-10px) translateY(0);
            opacity: 0.3;
            z-index: -1;
          }
          100% {
            transform: rotate(360deg) translateX(0) translateY(0);
            opacity: 0.6;
            z-index: 10;
          }
        }
      `}</style>
      <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0 relative">
      {/* Mesh gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-1/4 w-[150%] h-[150%] opacity-30 dark:opacity-20">
          <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-purple-600/30 via-blue-500/20 to-transparent blur-3xl"></div>
          <div className="absolute top-[60%] right-[20%] w-[35%] h-[35%] rounded-full bg-gradient-to-tl from-indigo-600/25 via-purple-500/15 to-transparent blur-3xl"></div>
          <div className="absolute bottom-[10%] left-[30%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-blue-600/20 via-indigo-500/10 to-transparent blur-3xl"></div>
          <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-gradient-to-br from-violet-600/20 to-transparent blur-2xl"></div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl mx-auto relative">
        <div className="text-center space-y-16">
          {/* Typography section */}
          <header className="space-y-6">
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter relative inline-block">
              <span 
                className="relative"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 2px 20px rgba(0,0,0,0.1)',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                }}
              >
                Builder
              </span>
            </h1>
            <p className="text-3xl md:text-4xl font-bold">
              <span className="text-zinc-200 font-light">
                Coming Soon
              </span>
            </p>
          </header>

          {/* Planet section */}
          <div className="flex items-center justify-center py-8">
            <div className="relative w-56 h-56 md:w-64 md:h-64">
              {/* Glass sphere base */}
              <div className="absolute inset-0 rounded-full bg-white/5 backdrop-blur-md"></div>
              
              {/* Subtle gradient overlay for depth */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/10"></div>
              
              {/* Top reflection - large diffused highlight */}
              <div className="absolute top-[8%] left-[15%] w-20 h-20 rounded-full bg-gradient-to-br from-white/25 via-white/10 to-transparent blur-2xl"></div>
              
              {/* Small bright center of highlight */}
              <div className="absolute top-[12%] left-[22%] w-8 h-8 rounded-full bg-white/40 blur-lg"></div>
              
              {/* Edge definition - glass rim */}
              <div className="absolute inset-0 rounded-full ring-1 ring-white/30 ring-inset"></div>
              
              {/* Bottom inner shadow for 3D depth */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_-15px_30px_rgba(0,0,0,0.15)]"></div>
              
              {/* Refraction effect - subtle color shift */}
              <div className="absolute inset-1 rounded-full bg-gradient-to-t from-blue/5 to-transparent"></div>
              
              {/* Rocket - outside rotating container */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="text-7xl md:text-8xl"
                  style={{
                    animation: 'float 6s ease-in-out infinite, hueShift 4s linear infinite',
                  }}
                >
                  🚀
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8">
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
              We're crafting a new way to scaffold TanStack apps. Check back soon.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
    </>
  )
}