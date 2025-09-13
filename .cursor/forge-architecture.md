# TanStack Forge Architecture Summary

## Overview

TanStack Forge is an AI-powered development studio that allows users to describe project ideas and have them transformed into fully functional TanStack Start applications. It combines AI assistance with real-time code editing, live preview, and deployment capabilities.

## Core Functionality

### Primary Features
- **AI-Powered Project Generation**: Users describe their project idea, and AI generates a complete TanStack Start application
- **Interactive Chat Interface**: Real-time conversation with AI to modify, enhance, and debug applications
- **Live Code Preview**: Real-time preview of applications using WebContainer technology
- **File Management**: Browse, edit, and manage project files through an intuitive interface
- **Deployment Ready**: Built-in deployment capabilities for generated applications
- **Multi-Model Support**: Supports both OpenAI (GPT-4, GPT-4 Mini) and Anthropic (Claude 3.5 Sonnet) models

## Architecture Components

### 1. Frontend Architecture

#### Routing Structure
```
/forge                    # Main forge landing page
/forge/editor/$projectId  # Project editor interface
```

#### Key Components

**Landing Page (`src/routes/forge/index.tsx`)**
- Project creation interface with description input
- Project statistics and recent projects display
- Authentication and API key validation
- Sidebar navigation

**Editor Interface (`src/routes/forge/editor.$projectId.tsx`)**
- Split-pane layout: Chat (left) + Code Preview (right)
- Real-time file synchronization
- Project management (rename, delete)
- Export functionality

#### UI Components (`src/forge/ui/`)

**Chat Component (`chat.tsx`)**
- Real-time AI conversation interface
- Model selection (OpenAI/Anthropic)
- Tool invocation visualization
- Markdown rendering with syntax highlighting
- Code block display with copy functionality

**Tabbed Viewer (`tabbed-viewer.tsx`)**
- Three-tab interface: Files, Preview, Deploy
- File navigator with diff visualization
- WebContainer preview with live reload
- Deployment interface

**WebContainer Preview (`webcontainer-preview.tsx`)**
- Live application preview using WebContainer
- Terminal output display
- Development server management
- Error handling and status reporting

**Sidebar (`sidebar.tsx`)**
- Project list and management
- Navigation controls
- Project actions (rename, delete)

### 2. Backend Architecture

#### Database Schema (`convex/schema.ts`)

**Core Tables:**
- `forge_projects`: Project metadata (name, description, timestamps)
- `forge_projectFiles`: File contents and paths for each project
- `forge_chatMessages`: Chat conversation history
- `llm_keys`: User API keys for AI providers
- `users`: User authentication and capabilities

#### Convex Functions (`convex/forge.ts`)

**Project Management:**
- `createProject`: Initialize new project with files
- `getProjects`: List user's projects
- `getProject`: Get project metadata
- `renameProject`: Update project name
- `deleteProject`: Remove project and all associated data

**File Operations:**
- `updateFile`: Create or update file content
- `deleteFile`: Remove file from project
- `getProjectFiles`: Retrieve all project files

**Chat Management:**
- `addChatMessage`: Add single message to conversation
- `addChatMessages`: Replace entire conversation
- `getChatMessages`: Retrieve conversation history
- `deleteChatMessages`: Clear conversation

### 3. API Layer

#### Project Creation API (`src/routes/api/forge.new-project.ts`)
- Validates user authentication and API keys
- Generates initial project structure using TanStack Start recipes
- Creates project in database with generated files
- Returns project ID for navigation

#### Chat API (`src/routes/api/forge.chat.ts`)
- Handles streaming AI conversations
- Manages tool invocations (file operations)
- Persists conversation history
- Supports multiple AI providers (OpenAI/Anthropic)

### 4. AI Integration

#### Tool System (`src/forge/tools.ts`)
- **listDirectory**: Browse project structure
- **readFile**: Read file contents
- **writeFile**: Create/update files with syntax highlighting
- **deleteFile**: Remove files from project
- Uses memfs for in-memory file system operations

#### Engine Handling (`src/forge/engine-handling/`)
- **generate-initial-payload.ts**: Creates TanStack Start project structure
- **server-functions.ts**: Server-side data fetching
- **create-app-wrapper.ts**: Application scaffolding
- **add-to-app-wrapper.ts**: Feature addition to existing apps

#### AI Recipes (`src/forge/data/tanstack-start-react-recipes.ts`)
- Comprehensive TanStack Start patterns and examples
- Project structure templates
- Route creation patterns
- Server function examples
- TanStack Query integration patterns

### 5. WebContainer Integration

#### WebContainer Provider (`src/forge/ui/web-container-provider.tsx`)
- Manages WebContainer lifecycle
- Handles file mounting and dependency installation
- Provides development server management
- Terminal output streaming

#### WebContainer Store (`src/forge/hooks/use-web-container.ts`)
- State management for WebContainer operations
- Setup step tracking (mounting, installing, starting, ready)
- Error handling and status reporting
- Preview URL management

### 6. Authentication & Security

#### User Capabilities
- `admin`: Full access to forge features
- `disableAds`: Ad-free experience
- `builder`: Project creation capabilities

#### API Key Management
- Secure storage of OpenAI and Anthropic API keys
- User-specific key isolation
- Active/inactive key management
- Provider-specific model selection

#### Project Access Control
- User-scoped project isolation
- Capability-based access validation
- Secure session token handling

## Data Flow

### Project Creation Flow
1. User enters project description on landing page
2. Frontend validates API keys and authentication
3. API generates TanStack Start project structure using AI
4. Project and files are stored in Convex database
5. User is redirected to editor interface

### Chat Interaction Flow
1. User sends message through chat interface
2. API validates authentication and retrieves user's API keys
3. AI processes message with project context and available tools
4. Tools execute file operations (read/write/delete)
5. Changes are persisted to database
6. Response is streamed back to user
7. Conversation history is saved

### Live Preview Flow
1. Project files are mounted to WebContainer
2. Dependencies are installed automatically
3. Development server starts
4. Preview URL is generated and displayed
5. Changes to files trigger automatic rebuilds
6. Terminal output is streamed to UI

## Technology Stack

### Frontend
- **Framework**: TanStack Router + TanStack Start
- **Styling**: Tailwind CSS
- **State Management**: Zustand (WebContainer), React Context
- **Code Editing**: CodeMirror with syntax highlighting
- **Markdown**: ReactMarkdown with rehype-highlight
- **AI Integration**: Vercel AI SDK

### Backend
- **Database**: Convex (real-time backend)
- **Authentication**: Better Auth with Clerk integration
- **AI Providers**: OpenAI, Anthropic
- **File System**: memfs for in-memory operations

### Development Tools
- **Build**: Vite
- **Type Safety**: TypeScript
- **Code Quality**: Prettier, ESLint
- **Package Manager**: pnpm

## Key Design Patterns

### 1. Real-time Synchronization
- Convex provides real-time updates for project files and chat messages
- WebContainer maintains live preview state
- Optimistic updates for better UX

### 2. Tool-based AI Interaction
- AI uses structured tools for file operations
- Tool invocations are visualized in chat interface
- Atomic operations ensure data consistency

### 3. Progressive Enhancement
- Graceful degradation when WebContainer fails
- Fallback to file browser when preview unavailable
- Error boundaries for robust error handling

### 4. Security-First Design
- Capability-based access control
- User-scoped data isolation
- Secure API key management
- Input validation and sanitization

## Performance Considerations

### Optimization Strategies
- Lazy loading of project files
- Memoized components for chat rendering
- Efficient file tree generation
- Streaming responses for large operations

### Scalability
- Convex handles real-time updates efficiently
- WebContainer instances are isolated per project
- Database queries are optimized with proper indexing
- AI API calls are rate-limited and cached where appropriate

## Future Enhancement Opportunities

### Potential Improvements
- Multi-framework support (Vue, Angular, Solid)
- Collaborative editing capabilities
- Advanced deployment options (Vercel, Netlify)
- Project templates and starter kits
- Integration with version control systems
- Advanced AI features (code analysis, optimization suggestions)

### Technical Debt
- Some authentication checks are temporarily disabled (marked with TODO)
- WebContainer error handling could be more robust
- File path normalization could be more consistent
- Error boundaries need better user messaging

## Conclusion

TanStack Forge represents a sophisticated AI-powered development platform that successfully combines modern web technologies with advanced AI capabilities. Its architecture demonstrates excellent separation of concerns, real-time capabilities, and user experience design. The system is well-positioned for future enhancements while maintaining security and performance standards.