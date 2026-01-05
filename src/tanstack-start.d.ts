/// <reference types="vite/client" />
/// <reference types="@tanstack/react-start" />

// This file ensures TanStack Start type augmentations are loaded
// The reference above should trigger the serverRoute module augmentation
// that adds the `server` property to FilebaseRouteOptionsInterface

// Import generated route tree types if available
import '../.tanstack-start/server-routes/routeTree.gen'
