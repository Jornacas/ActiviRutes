# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ActiviRutes is a Next.js application for managing delivery and pickup routes for schools in Barcelona. It helps coordinate the delivery and collection of educational materials across different schools with activities tracking, route optimization, and calendar management.

## Development Commands

### Core Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Package Management
- Uses both npm (package-lock.json) and pnpm (pnpm-lock.yaml)
- Primary package manager appears to be npm based on scripts

## Architecture Overview

### Frontend Framework
- **Next.js 14.2.16** with App Router (`app/` directory structure)
- **TypeScript** for type safety
- **Tailwind CSS** for styling with custom configuration
- **shadcn/ui** components library (configured in `components.json`)

### Key Components Structure
- `app/page.tsx` - Main application component with dual-mode interface (entregas/recogidas)
- `components/route-editor.tsx` - Route planning and optimization editor
- `components/ui/` - Reusable UI components from shadcn/ui
- `lib/utils.ts` - Utility functions

### Data Management
- Fetches data from Google Sheets via CSV export
- Processes school data for both delivery (entregas) and pickup (recogidas) modes
- Route storage in localStorage for saved routes
- No external database - relies on Google Sheets as data source

### Core Features
1. **Delivery Module (Entregas)**: Plans material deliveries to schools based on course start dates
2. **Pickup Module (Recogidas)**: Organizes material collection from schools based on activity schedules
3. **Route Editor**: Advanced route optimization with Google Maps integration
4. **Calendar Management**: Holiday tracking and week-based planning

## Key Dependencies

### UI & Styling
- `@radix-ui/*` - Headless UI components
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` - Component variant handling
- `clsx` & `tailwind-merge` - Conditional styling
- `lucide-react` - Icon library

### Functionality
- `date-fns` - Date manipulation and formatting
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `zod` - Schema validation
- `embla-carousel-react` - Carousel components
- `recharts` - Charting library
- `sonner` - Toast notifications

## Google Sheets Integration

### Configuration
- Sheet ID: `1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I`
- Sheet Name: "Dades"
- Expected columns: ESCOLA, UBICACIÓ, DIA, ACTIVITAT, TORN, MONITORA, etc.

### Data Processing
- CSV parsing with proper quote handling
- School consolidation by name
- Activity mapping (TC, CO, JC, DX to materials)
- Date parsing for course schedules

## Development Patterns

### State Management
- React hooks (useState, useMemo, useEffect)
- Local state management (no external state library)
- localStorage for route persistence

### Styling Conventions
- Tailwind utility classes
- shadcn/ui component styling
- Consistent color scheme (blue primary, green success, red danger)
- Responsive design with mobile-first approach

### Data Flow
1. Fetch from Google Sheets → CSV parsing
2. Process into typed interfaces (School, DeliverySchool)
3. Generate route plans with optimization
4. Export to external navigation tools

## Route Optimization

### Algorithm Features
- Geographic proximity grouping by Barcelona zones
- Time-based prioritization (morning before afternoon)
- Activity-based consolidation
- Holiday avoidance

### External Integrations
- Google Maps route export
- RouteXL optimization service
- OpenStreetMap alternatives

## Important Notes

- The app expects public Google Sheets access for data fetching
- Route optimization uses mock data (would need real Google Maps API for production)
- All school names are prefixed with "Escola" except "Academia"
- Week planning starts on Monday (weekStartsOn: 1)
- Time calculations assume 20-25 minutes per stop + travel time

## File Organization

```
app/
  ├── globals.css          # Global styles
  ├── layout.tsx           # Root layout with theme provider
  ├── loading.tsx          # Loading component
  └── page.tsx             # Main application logic

components/
  ├── route-editor.tsx     # Route planning interface
  ├── theme-provider.tsx   # Theme context provider
  └── ui/                  # shadcn/ui components

lib/
  └── utils.ts             # Utility functions (cn helper)
```

## Type Definitions

Key interfaces are defined inline in `app/page.tsx`:
- `School` - Pickup route schools
- `DeliverySchool` - Delivery route schools  
- `DeliveryPlan` - Consolidated delivery planning
- `Holiday` - Holiday management
- `RouteItem` - Route editor items

## Testing & Quality

- No test framework currently configured
- TypeScript provides compile-time checks
- ESLint configured for code quality
- No specific testing commands available