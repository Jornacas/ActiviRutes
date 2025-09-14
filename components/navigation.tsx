"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Truck, Route, User, Info } from "lucide-react"

const navigationItems = [
  {
    name: "Rutas",
    href: "/",
    icon: Route,
    description: "Crear y gestionar rutas"
  },
  {
    name: "Admin",
    href: "/admin", 
    icon: User,
    description: "Panel de control de entregas"
  },
  {
    name: "Info",
    href: "/info",
    icon: Info,
    description: "Información de la aplicación"
  }
]

export function Navigation() {
  const pathname = usePathname()
  
  // No mostrar navegación en páginas del transportista o informes
  if (pathname.includes('/transporter/') || pathname.includes('/informe/')) {
    return null
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-xl font-bold text-gray-900">ActiviRutes</h1>
          </div>
          
          {/* Navigation Links */}
          <div className="flex space-x-8">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                  title={item.description}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
} 