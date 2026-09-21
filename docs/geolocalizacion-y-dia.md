# Geolocalización, hora y «el día de hoy»

> Actualización `update_012_geolocalizacion.sql` + `src/lib/{geo,dia,reflexiones}.ts` + `src/features/geo/**`.
> Objetivo: que la plataforma se sienta **viva** y esté lista para **internacionalizarse** sin inventar datos.

## 1. Ubicación de la persona

| Fuente | Cuándo | Precisión |
|---|---|---|
| Zona horaria del dispositivo (`Intl`) | Automática, sin pedir permisos | País y capital de referencia |
| Elección manual (país y ciudad) | Chip «📍 Cuenca, Ecuador · Cambiar» | La ciudad elegida |
| GPS | **Solo si la persona pulsa el botón** | Se redondea a 2 decimales (≈ 1 km) |

- Se guarda en el navegador (`localStorage`); si la persona quiere, la guarda en su perfil con `set_my_location()`.
- **Privacidad.** `user_private.city/lat/lng/timezone` solo las lee su dueña o dueño (RLS `user_id = auth.uid()`) y solo se escriben con
  `set_my_location()` (valida país, coordenadas, zona y ciudad, y redondea a 2 decimales aunque el cliente envíe más). Lo único público es
  `profiles.country` (dice solo el país). `clear_my_location()` lo borra todo.
- Por defecto (sin información) se usa **Cuenca, Ecuador**.

## 2. Negocios y «Cerca de mí»

- `providers.country` (por defecto `EC`), `city`, `lat`, `lng`. El alta pide país, ciudad y, opcionalmente, el punto del local con
  «📍 Marcar mi negocio en el mapa» (3 decimales ≈ 110 m: es un lugar público).
- `search_providers(..., p_lat, p_lng, ..., p_country)`: `p_country` filtra por país; con `p_lat/p_lng` ordena por cercanía y devuelve
  `distance_km` (los negocios sin punto van al final). La interfaz lo muestra como «300 m», «3,2 km», «48 km».
- La barra de filtros tiene el botón **«📍 Cerca de mí»**: añade `lat`, `lng` y `pais` a la dirección solo cuando la persona lo pulsa.

## 3. El día de hoy (`PulsoDelDia`, `RelojCiudad`)

Todo se calcula **en el dispositivo** para el lugar de la persona, sin servicios externos:

- **Hora y fecha** de su zona horaria (con horario de verano donde existe). Reloj en la barra superior que enlaza a `/#hoy`.
- **Saludo y frase de entrada**: varían por momento del día, por día y por visita (no es siempre lo mismo).
- **Luna** (ciclo sinódico medio, verificado con la luna nueva del 11-ene-2024 y la llena del 25-ene-2024), **amanecer/ocaso**
  (ecuaciones de la NOAA; en Cuenca ≈ 06:00 / 18:10 todo el año) y **signo solar**.
- **Efemérides**: feriados y fechas de Ecuador (solo se atribuyen a Ecuador), fechas móviles (Carnaval, Viernes Santo, Pascua por el
  algoritmo de Meeus, Día de la Madre y del Padre) y conmemoraciones mundiales, que valen en cualquier país. «Próxima efeméride» mira hasta 45 días.
- **Tema de la semana** con enlace a una acción de la plataforma.
- Sin cifras inventadas: solo lo que se puede calcular o está en el catálogo curado.

## 4. Reflexiones

90 reflexiones de tres tradiciones (espiritismo, estoicismo, psicología). La rotación es determinista: cada «ronda» recorre todo el catálogo
una vez, barajado con una semilla y entrelazado por tradición; no se repite ninguna entre días seguidos (tampoco al cambiar de ronda) y cada
persona parte de un desplazamiento propio (`semillaDePersona`), por lo que dos personas no ven lo mismo el mismo día. «Otra reflexión»
adelanta la rotación. **Solo llevan `fuente` las pocas frases textuales comprobables**; el resto declara `idea` o se presenta como reflexión propia.

## 5. Qué falta para internacionalizar del todo

- **Idioma**: la interfaz está en español; faltan traducciones (i18n) y formatos de fecha por idioma.
- **Moneda local** y precios por país; **pasarelas** por país (hoy PayPhone —Ecuador— y PayPal).
- **Efemérides y feriados** de otros países (hoy solo Ecuador tiene calendario propio; las conmemoraciones mundiales valen para todos).
- **Mapa** y búsqueda por dirección (hoy: punto por GPS/ciudad de referencia).
- Catálogo de zonas/barrios por ciudad (hoy fuera de Ecuador la zona es texto libre).
