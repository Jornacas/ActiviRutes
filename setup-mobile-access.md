# 📱 Configuración de Acceso Móvil para Transportistas

## 🚀 Opción 1: Ngrok (Recomendada para desarrollo)

### Instalación única:
```bash
# Instalar ngrok globalmente
npm install -g ngrok

# O descargar desde https://ngrok.com/download
```

### Uso diario:
```bash
# 1. Inicia tu app Next.js (terminal 1)
npm run dev

# 2. En otra terminal, crea el túnel público
ngrok http 3000
```

**Resultado**: Te dará una URL como `https://abc123.ngrok.io` que funciona desde cualquier lugar.

### ✅ Ventajas:
- ✅ Funciona desde cualquier lugar con datos móviles
- ✅ Setup en 2 minutos
- ✅ HTTPS automático (necesario para cámara)
- ✅ Gratuito para uso básico

---

## ☁️ Opción 2: Despliegue en Producción (Solución permanente)

### Vercel (Más fácil):
```bash
# Instalar CLI de Vercel
npm install -g vercel

# Desplegar
npx vercel

# Seguir las instrucciones
```

### Netlify:
1. Sube tu código a GitHub
2. Ve a [netlify.com](https://netlify.com)
3. Conecta tu repositorio
4. Deploy automático

### ✅ Ventajas:
- ✅ URL permanente (ej: `https://activirutes.vercel.app`)
- ✅ Sin configuración diaria
- ✅ Escalable para múltiples transportistas
- ✅ Gratuito para proyectos pequeños

---

## 📱 Opción 3: LocalTunnel (Alternativa gratis)

```bash
# Instalar
npm install -g localtunnel

# Usar (mientras tu app corre en puerto 3000)
lt --port 3000
```

**Resultado**: URL temporal como `https://funny-dog-123.loca.lt`

---

## 🔧 Configuración Recomendada

Para **desarrollo activo**:
1. Usa **Ngrok** para pruebas diarias
2. URL nueva cada vez que reinicies

Para **uso en producción**:
1. Despliega en **Vercel/Netlify**
2. URL permanente que puedes guardar

---

## 🛠️ Script de Automatización

Crea un archivo `start-with-tunnel.bat` (Windows) o `start-with-tunnel.sh` (Mac/Linux):

```bash
#!/bin/bash
# Iniciar app y túnel automáticamente

echo "🚀 Iniciando ActiviRutes con acceso móvil..."

# Iniciar Next.js en background
npm run dev &
NEXT_PID=$!

# Esperar que Next.js esté listo
sleep 5

# Iniciar ngrok
echo "🌐 Creando túnel público..."
ngrok http 3000

# Cleanup al salir
trap "kill $NEXT_PID" EXIT
```

**Uso**: `./start-with-tunnel.sh` y tendrás todo listo.

---

## 🔒 Consideraciones de Seguridad

- ✅ Los links son únicos por ruta (no reutilizables)
- ✅ Los datos se guardan localmente + Google Sheets
- ⚠️ En desarrollo, cualquiera con el link ngrok puede acceder
- ✅ En producción, puedes añadir autenticación si necesitas

---

## 🆘 Solución de Problemas

**Error "tunnel session failed"**:
- Reinicia ngrok
- Verifica que el puerto 3000 esté libre

**No funciona la cámara**:
- Ngrok/producción usan HTTPS (✅)
- localhost usa HTTP (❌ - cámara bloqueada)

**Link muy largo**:
- Usa un acortador de URLs (bit.ly, tinyurl)
- O despliega en producción para URLs más cortas