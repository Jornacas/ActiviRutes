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
- `components/navigation.tsx` - **NEW**: Consistent navigation bar across the app
- `components/ui/` - Reusable UI components from shadcn/ui
- `lib/utils.ts` - Utility functions

### Data Management
- **Google Sheets**: Primary data source via CSV export and Google Apps Script
- **localStorage**: 
  - Route storage for saved routes
  - Individual delivery reports (`delivery_${deliveryId}`)
  - Debug logs persistence (`debugLogs_activirutes`)
- **Google Apps Script**: Backend for delivery data and real-time updates
- No external database - relies on Google Sheets as data source

### Core Features
1. **Delivery Module (Entregas)**: Plans material deliveries to schools based on course start dates
2. **Pickup Module (Recogidas)**: Organizes material collection from schools based on activity schedules
3. **Route Editor**: Advanced route optimization with Google Maps integration
4. **Transporter Module**: Complete delivery tracking with photo capture and signatures
5. **Admin Panel**: Real-time monitoring and management of deliveries
6. **Individual Reports**: Detailed delivery reports with photo/signature viewing
7. **Calendar Management**: Holiday tracking and week-based planning

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
- **Sheet ID**: `1C_zHy4xiRXZbVerVnCzRB819hpRKd9b7MiSrHgk2h0I`
- **Sheet Name**: "Dades" (main data), "Entregas" (delivery tracking)
- **Google Apps Script URL**: `https://script.google.com/macros/s/AKfycbz__Y99LWani6uG87sM30fEKozuZsz6YpD94dgXMtboYYZFW1E6epJRS1sjKBtNyRkN/exec`
- Expected columns: ESCOLA, UBICACIÓ, DIA, ACTIVITAT, TORN, MONITORA, etc.

### Data Processing
- CSV parsing with proper quote handling
- School consolidation by name
- Activity mapping (TC, CO, JC, DX to materials)
- Date parsing for course schedules
- **NEW**: Delivery data tracking with photos and signatures

## New Features Implemented (September 2025)

### 🚚 Transporter Module Enhancements
**File: `app/transporter/[routeId]/page.tsx`**

1. **Camera Functionality**: 
   - ✅ **FIXED**: Switched from WebRTC to native file input (`<input type="file" capture="environment">`)
   - Reliable photo capture on smartphones
   - Base64 encoding for storage and transmission

2. **Delivery Tracking**:
   - Complete delivery data collection (photo, signature, timestamp, location)
   - Unique delivery IDs (`del_${timestamp}`)
   - localStorage persistence for individual reports
   - Event-driven updates to Admin panel

3. **Ultra-Resistant Debug Panel**:
   - Z-index 99999 for maximum visibility
   - Global error capture (window.error, unhandledrejection)
   - Persistent logs in localStorage
   - Visual indicators for critical errors (🚨)
   - Copy logs to clipboard functionality

### 🔗 URL Shortening & QR Codes
**File: `components/route-editor.tsx`**

1. **Multi-Service URL Shortening**:
   - Primary: `is.gd` API
   - Fallback: `tinyurl.com` API
   - Error handling and user feedback
   - Automatic QR code generation with shortened URLs

2. **Enhanced Transporter Links**:
   - Compact shareable links
   - Reliable QR code generation via `api.qrserver.com`
   - URL validation before QR generation

### 🏢 Admin Panel
**File: `app/admin/page.tsx`**

1. **Real-time Delivery Monitoring**:
   - Event-driven updates (not time-based polling)
   - Delivery list with filters and search
   - View individual reports, copy data, delete entries
   - Connection status indicators

2. **Data Source Management**:
   - Local storage integration
   - Google Sheets connectivity (with CORS limitations)
   - Hybrid approach for data persistence

### 📄 Individual Delivery Reports
**File: `app/informe/[deliveryId]/page.tsx`**

1. **Complete Report Visualization**:
   - Photo and signature viewing/downloading
   - Delivery details and timestamps
   - Share and print functionality
   - Base64 image handling

### 🧭 Navigation System
**File: `components/navigation.tsx`**

1. **Consistent Navigation**:
   - Links to Rutas, Admin, and Info
   - Automatic hiding on transporter and report pages
   - Responsive design

### 🔧 Google Apps Script Backend
**File: `google-apps-script/Code.gs`**

1. **Enhanced Data Handling**:
   - `doPost` for delivery submissions
   - `doGet` for CORS preflight handling
   - `getDeliveriesFromSheet` for data retrieval
   - Automatic CORS handling (GAS limitation workaround)

## Current Issues & Debugging

### 🚨 CRITICAL ISSUE: Application Error on Smartphone

**Problem**: When confirming a delivery on smartphone, user gets:
```
"Application error: a client-side exception has occurred (see the browser console for more information)."
```

**Status**: ❌ **PERSISTS** despite multiple fixes

**Impact**:
- Data DOES reach Google Sheets ✅
- Debug panel becomes inaccessible ❌
- Report links generate errors ❌
- Admin panel doesn't load Google Sheets data ❌

**Debugging Attempts**:
1. ✅ Added comprehensive try-catch blocks in `handleDeliver`
2. ✅ Implemented ultra-resistant debug panel with:
   - Global error capture (`window.addEventListener('error')`)
   - Promise rejection capture (`unhandledrejection`)
   - Persistent localStorage logging
   - Maximum z-index (99999) for visibility
3. ✅ Removed all `alert()` calls that could block UI
4. ✅ Added visual error indicators and copy functionality

**Next Steps Needed**:
- Capture exact error stack trace using the new debug panel
- Identify the specific line causing the client-side exception
- Debug smartphone-specific JavaScript compatibility issues

### 🔗 CORS Limitations with Google Apps Script

**Issue**: Direct data fetching from Google Apps Script has CORS limitations
**Workaround**: 
- Admin panel loads from localStorage (populated by transporter)
- Warning message about GAS limitations displayed
- Individual reports work via localStorage persistence

## Development Patterns

### State Management
- React hooks (useState, useMemo, useEffect)
- Local state management (no external state library)
- localStorage for route persistence and delivery reports
- Event-driven communication between components

### Styling Conventions
- Tailwind utility classes
- shadcn/ui component styling
- Consistent color scheme (blue primary, green success, red danger)
- Responsive design with mobile-first approach

### Data Flow
1. **Route Planning**: Fetch from Google Sheets → CSV parsing → Route optimization
2. **Delivery Execution**: localStorage route data → Camera capture → Google Apps Script submission
3. **Report Generation**: localStorage delivery data → Individual report pages
4. **Admin Monitoring**: Event-driven updates → localStorage consolidation → Admin dashboard

## Testing & Quality

- No test framework currently configured
- TypeScript provides compile-time checks
- ESLint configured for code quality
- **NEW**: Comprehensive error logging and debugging system
- **NEW**: Production debugging via ultra-resistant debug panel

## File Organization

```
app/
  ├── globals.css              # Global styles
  ├── layout.tsx               # Root layout with navigation
  ├── loading.tsx              # Loading component
  ├── page.tsx                 # Main application logic
  ├── admin/
  │   └── page.tsx             # NEW: Admin panel for delivery monitoring
  ├── informe/
  │   └── [deliveryId]/
  │       └── page.tsx         # NEW: Individual delivery reports
  ├── transporter/
  │   └── [routeId]/
  │       └── page.tsx         # Enhanced transporter with camera & debug
  └── api/
      └── geocode/
          └── route.ts         # Geocoding API endpoint

components/
  ├── route-editor.tsx         # Enhanced with URL shortening & QR
  ├── navigation.tsx           # NEW: Consistent navigation bar
  ├── theme-provider.tsx       # Theme context provider
  └── ui/                      # shadcn/ui components

google-apps-script/
  ├── appsscript.json         # GAS configuration
  └── Code.gs                 # Enhanced backend with CORS handling
```

## Type Definitions

Key interfaces are defined across multiple files:
- **Main App** (`app/page.tsx`): `School`, `DeliverySchool`, `DeliveryPlan`, `Holiday`
- **Transporter** (`app/transporter/[routeId]/page.tsx`): `DeliveryData`, `RouteData`
- **Route Editor** (`components/route-editor.tsx`): `RouteItem`, URL shortening types

## Recent Development History

### September 2025 - Complete Delivery System Implementation

**Major Features Added:**
1. ✅ **Camera Integration**: Native file input solution for reliable photo capture
2. ✅ **URL Shortening**: Multi-service fallback system with QR code generation
3. ✅ **Admin Panel**: Real-time delivery monitoring with localStorage integration
4. ✅ **Individual Reports**: Complete delivery visualization with photo/signature download
5. ✅ **Debug System**: Ultra-resistant error capture and logging
6. ✅ **Navigation**: Consistent UI navigation across all pages
7. ✅ **Google Apps Script**: Enhanced backend with proper CORS handling

**Current Blocking Issue:**
- ❌ **Smartphone Application Error**: Prevents full system functionality despite data reaching backend

**Technical Debt:**
- CORS limitations with Google Apps Script require localStorage workarounds
- TypeScript linter warnings in camera chunk processing (non-critical)
- Need smartphone-specific JavaScript debugging

## Deployment Information

- **Platform**: Vercel
- **Domain**: `activi-rutes.vercel.app`
- **Build**: Automatic deployment from main branch
- **Environment**: Production-ready with comprehensive error logging