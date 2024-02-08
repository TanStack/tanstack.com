import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/query/$version/')({
  // loader: () => fetchFrontMatters(),
  // notFoundComponent: () => <PostNotFound />,
  component: BlogIndex,
  meta: () => [
    {
      title: 'Blog',
    },
  ],
})

function BlogIndex() {
  return <div>hello</div>
}
