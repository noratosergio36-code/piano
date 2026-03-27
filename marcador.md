# Instrucción de Desarrollo: Sistema de Puntuación y Gamificación (Estilo Just Dance)

Actúa como un Desarrollador Frontend Senior. Tu tarea es implementar un sistema de puntuación, combos y retroalimentación visual (popups flotantes) en la aplicación "Piano Maestro".

## Contexto
- El público objetivo principal incluye niños, por lo que la UI debe ser muy llamativa, colorida y positiva.
- Modos afectados: `FOLLOW` (ritmo/timing) y `WAIT` (reacción/precisión).
- El renderizado principal es en Canvas, pero los "Popups" de puntuación deben hacerse usando elementos DOM absolutos superpuestos (Overlay) con animaciones CSS para facilitar el estilizado de texto.

Por favor, ejecuta la implementación en las siguientes fases:

### Fase 1: Estado de Puntuación
1. Modifica `src/context/AppContext.jsx` (o crea un `ScoreContext` separado si lo ves más limpio).
2. Añade al estado: `score: 0`, `combo: 0`, y `activePopups: []`.
3. Crea acciones: `ADD_SCORE`, `RESET_COMBO`, `ADD_POPUP`, `REMOVE_POPUP`.

### Fase 2: Componente de Popups Visuales (Overlay)
1. Crea `src/components/ScoreOverlay.jsx`.
2. Este componente mapeará el array `activePopups` y renderizará `<div>`s con posicionamiento absoluto sobre el Canvas.
3. Cada popup necesita una animación CSS `@keyframes floatUpAndFade` (sube unos 50px y desaparece en 1 segundo).
4. Los popups deben recibir props de estilo: 
   - `Perfecto` / `+10`: Color verde neón o dorado, letra grande y gruesa.
   - `Ups` / `-1`: Color grisáceo o morado, letra más pequeña.
5. Crea `src/components/ScoreBoard.jsx` para mostrar el Score total y el Combo actual en una esquina superior. Si el combo es > 5, añádele una animación CSS de pulso o brillo.

### Fase 3: Lógica de Puntuación - Modo FOLLOW (Seguir)
1. En tu lógica de intersección (probablemente donde manejas la entrada MIDI vs `currentTime`):
2. Cuando el usuario presione una tecla, verifica si está dentro de la ventana de tolerancia de una nota que está cayendo.
3. **Acierto:** Despacha `ADD_SCORE(10)`, incrementa `combo`, y despacha `ADD_POPUP` con texto "¡PERFECTO!" en las coordenadas (x, y) de la tecla presionada.
4. **Fallo (Tecla equivocada):** Despacha `ADD_SCORE(-1)`, `RESET_COMBO`, y `ADD_POPUP` con texto "¡UPS!".
5. **Miss (Dejar pasar la nota sin tocarla):** Si la nota sale del límite inferior del Canvas sin ser tocada, aplica la misma penalización de fallo.

### Fase 4: Lógica de Puntuación - Modo WAIT (Espera)
1. En la lógica de `usePlayback.js` o tu manejador del Wait Mode:
2. Cuando el tiempo se congela (`isFrozen = true`), guarda un *timestamp* del momento exacto del congelamiento.
3. Cuando el usuario presione una tecla:
   - **Fallo:** Si no es la nota esperada, resta 1 punto, resetea el combo y muestra "¡CASI!".
   - **Acierto:** Si es correcta, suma 10 puntos, incrementa combo. Además, si `(TiempoActual - TimestampCongelamiento) < 2000ms`, añade 5 puntos extra y muestra un popup especial "¡SÚPER RÁPIDO!".

Asegúrate de que los IDs de los popups sean únicos (usando `Date.now()` o `crypto.randomUUID()`) para que React los renderice y desmonte correctamente tras su animación.