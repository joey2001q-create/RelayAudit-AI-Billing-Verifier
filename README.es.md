<div align="center">

<p>
  <a href="README.md">简体中文</a>
  ·
  <a href="README.en.md">English</a>
  ·
  <strong>Español</strong>
  ·
  <a href="README.ja.md">日本語</a>
</p>

# RelayAudit

### Verificador de facturación para relés de IA

**Utiliza solicitudes reproducibles, precios públicos y registros de facturación reales para comprobar cuánto cobró un relé de IA.**

Sin especular sobre el enrutamiento interno: RelayAudit solo comprueba si el uso de Tokens y los cargos observados en esta prueba coinciden.

<p>
  <a href="https://relay-billing-verifier.vercel.app"><img alt="Disponible en Vercel" src="https://img.shields.io/badge/Vercel-Online-000000?style=for-the-badge&amp;logo=vercel&amp;logoColor=white"></a>
  <a href="https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier/actions/workflows/ci.yml"><img alt="Integración continua" src="https://img.shields.io/github/actions/workflow/status/joey2001q-create/RelayAudit-AI-Billing-Verifier/ci.yml?branch=main&amp;style=for-the-badge&amp;label=CI"></a>
  <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/License-MIT-146c43?style=for-the-badge"></a>
  <img alt="Node.js 20 o posterior" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&amp;logo=node.js&amp;logoColor=white">
</p>

<p>
  <a href="https://relay-billing-verifier.vercel.app"><strong>Probar en línea</strong></a>
  ·
  <a href="#inicio-rápido"><strong>Inicio rápido</strong></a>
  ·
  <a href="#método-de-verificación"><strong>Método</strong></a>
  ·
  <a href="#seguridad"><strong>Seguridad</strong></a>
</p>

</div>

## Alcance actual

La versión actual solo verifica el uso de Tokens y los precios. No mide la velocidad.

La velocidad de un relé depende de la región y la ruta de red de la prueba, la carga y concurrencia de los nodos, la política de enrutamiento, el estado del servicio upstream, el establecimiento de conexiones DNS y TLS, y el momento de la prueba. La latencia de una sola ubicación o solicitud no representa la calidad general del servicio de una plataforma.

Está previsto que una versión futura trate la velocidad como una dimensión independiente. Tomará muestras en varias regiones, franjas horarias y rondas, y mostrará por separado el tiempo hasta el primer Token, el tiempo total de respuesta, la tasa de éxito y la variación, sin mezclarlos con las conclusiones de facturación.

## Descripción general

RelayAudit envía un lote reproducible de solicitudes fijas a uno o dos endpoints compatibles con OpenAI, lee el campo `usage` devuelto, calcula el coste nominal según precios públicos del modelo y lo compara con el cargo real de la plataforma introducido por el usuario.

Todo el proyecto es de código abierto. Cualquier persona puede revisar el corpus de prueba, los parámetros de solicitud, la normalización de usage, las fórmulas de precios y la generación de informes, y repetir el experimento en su propio entorno. Esto reduce la posibilidad de mostrar resultados selectivos o favorecer a una plataforma concreta.

## Funciones principales

- Verifica una plataforma de forma predeterminada o envía solicitudes semánticamente idénticas a dos plataformas.
- Prueba la estabilidad de un solo turno, el contexto multivuelta y la reutilización de caché.
- Muestra en tiempo real el escenario, la ronda, la plataforma y el progreso general.
- Utiliza el corpus fijo integrado por defecto o permite activar un corpus personalizado en Opciones avanzadas.
- Sincroniza los precios de los modelos 5.6 desde un repositorio público y verifica el archivo mediante SHA-256.
- Normaliza campos `usage` habituales de estilo OpenAI y Anthropic.
- Calcula el cargo de la plataforma, el cargo nominal esperado, la desviación relativa y el multiplicador medido.
- Etiqueta cada conclusión con el modelo y la hora de finalización, y conserva en el navegador los últimos 20 resúmenes de prueba sin datos sensibles.
- Exporta evidencia JSON sin datos sensibles, un informe HTML y un resumen de texto.
- La API Key solo se utiliza durante la prueba actual; no se guarda ni aparece en los informes.

## Elegir cómo ejecutarlo

Las versiones alojada y autohospedada utilizan exactamente el mismo corpus, sincronización de precios, normalización de usage y fórmulas de facturación.

| Opción | Recomendada para | Ruta de la API Key | Acceso |
| --- | --- | --- | --- |
| **Versión alojada en Vercel** | Uso inmediato sin instalación | Navegador → RelayAudit Vercel Function → relé de destino | [Ejecutar una prueba en línea](https://relay-billing-verifier.vercel.app) |
| **Versión autohospedada** | Verificación independiente, endpoints privados y control estricto de credenciales | Navegador → servicio RelayAudit propio → relé de destino | [Ver el código fuente público](https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier) |

> [!NOTE]
> La versión alojada solo puede acceder a relés HTTPS públicos. Utiliza la versión autohospedada para probar localhost, redes privadas o endpoints HTTP.

## Inicio rápido

### Uso en línea

Abre la **[versión alojada de RelayAudit](https://relay-billing-verifier.vercel.app)** e introduce la Base URL y la API Key de la plataforma que quieras probar.

### Ejecución local o despliegue en Vercel

Se requiere Node.js 20 o posterior. Clona el repositorio una vez y ejecútalo localmente o despliégalo en tu propia cuenta de Vercel.

```bash
git clone https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier.git
cd RelayAudit-AI-Billing-Verifier
npm ci

# Opción 1: ejecutar localmente
npm start

# Opción 2: desplegar en tu propia cuenta de Vercel
npx vercel
```

Después de iniciarlo localmente, abre <http://127.0.0.1:4312>. También puedes clonar y desplegar el repositorio con un clic:

[![Desplegar con Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjoey2001q-create%2FRelayAudit-AI-Billing-Verifier)

## Flujo de uso

Ambas versiones siguen los mismos pasos:

1. Pega un comando cURL, JSON o una configuración de tres líneas, o introduce manualmente la Base URL, la API Key y el alias del modelo.
2. Selecciona `gpt-5.6-sol`, `gpt-5.6-terra` o `gpt-5.6-luna`.
3. Ejecuta la verificación estándar o profesional y observa el progreso de cada solicitud.
4. Busca en el detalle de facturación el cargo de alta precisión correspondiente a esta prueba. El multiplicador predeterminado es `1`; cámbialo solo si la plataforma utiliza otro.
5. Revisa la conclusión y exporta la evidencia cuando sea necesario.

Al seleccionar un modelo 5.6, su nombre y precio se completan automáticamente desde el catálogo dinámico. Para un modelo personalizado, introduce el nombre y los precios por millón de Tokens en Opciones avanzadas. El README no mantiene una tabla de precios estática duplicada para evitar diferencias con la fuente dinámica.

Los precios proceden de [`Wei-Shaw/model-price-repo`](https://github.com/Wei-Shaw/model-price-repo). El servicio descarga el JSON de precios y su SHA-256, y solo actualiza la página tras validar ambos. Si la red no está disponible o la validación falla, utiliza la instantánea válida más reciente incluida en el repositorio. Los informes registran si la prueba utilizó precios remotos, la instantánea integrada o precios introducidos por el usuario, junto con el hash del archivo.

Los mantenedores pueden ejecutar `npm run pricing:sync` para actualizar la instantánea integrada. Un workflow programado del repositorio también busca actualizaciones cada día.

Al activar un corpus personalizado en Opciones avanzadas, RelayAudit utiliza el texto indicado como entrada fija y añade la restricción de salida corta para devolver solo `BILLING_TEST_OK`. El máximo predeterminado es de `16` Tokens de salida. Se trata de un límite superior, no de una garantía de cantidad exacta. Evita solicitudes de generación aleatoria, resumen o reescritura, ya que provocan variaciones innecesarias en los Tokens de salida.

El multiplicador se introduce en el tercer paso, después de terminar las solicitudes, y su valor predeterminado es `1`. Solo afecta a la verificación de facturación, no a las solicitudes enviadas al relé. El usuario puede introducir otro multiplicador, como `0.8` o `1.2`.

## Método de verificación

```text
Coste base nominal = coste de entrada normal + coste de lectura de caché + coste de creación de caché + coste de salida
Cargo nominal esperado = coste base nominal × multiplicador anunciado
Multiplicador medido = importe facturado por la plataforma ÷ coste base nominal
Desviación relativa = (importe facturado - cargo nominal esperado) ÷ cargo nominal esperado
```

De forma predeterminada, RelayAudit considera que un resultado coincide con el multiplicador anunciado cuando la desviación relativa no supera el `2%`. Es una regla de interpretación de la herramienta, no un estándar del sector. El truncamiento decimal, el redondeo o la facturación retrasada pueden producir pequeñas diferencias.

## Consistencia de las solicitudes

- Cada prueba utiliza un corpus, marcadores de ronda, estructura de mensajes y parámetros de generación fijos.
- Una prueba de dos plataformas solo cambia las credenciales y los alias del modelo, y registra un SHA-256 de la solicitud semántica.
- Las pruebas multivuelta amplían el historial con mensajes assistant fijos y no introducen respuestas aleatorias del modelo en el turno siguiente.
- Las pruebas de reutilización de caché repiten exactamente el mismo contenido de solicitud.
- Las solicitudes utilizan `/v1/chat/completions` con `stream: false`; las solicitudes fallidas no se reintentan automáticamente.
- Las respuestas del modelo pueden variar. Los costes se calculan por separado a partir del `usage` real devuelto por cada plataforma.

La “proporción de lectura de caché” es la proporción de Tokens leídos de caché sobre el total de Tokens de entrada. No equivale a la tasa interna real de aciertos de caché de la plataforma. Si el servicio upstream no devuelve detalles de caché, RelayAudit muestra “no informado” en lugar de interpretarlo como `0%`.

## Límites de la evidencia

RelayAudit puede demostrar:

- Qué solicitudes semánticas reproducibles se enviaron durante esta prueba;
- Cuánto uso de Tokens devolvió la plataforma;
- Si el importe facturado coincide con los precios públicos y el multiplicador introducido por el usuario.

RelayAudit no puede demostrar:

- Si el relé llamó realmente al modelo upstream que afirma utilizar;
- El coste upstream interno del relé;
- Detalles no publicados sobre enrutamiento, caché o implementación de facturación;
- El comportamiento de facturación a largo plazo fuera de esta muestra.

Por tanto, la conclusión del informe solo se aplica a los datos de facturación observables de esta prueba.

## Seguridad

- En la versión alojada en Vercel, la API Key se envía temporalmente desde el navegador a una Vercel Function, que después solicita el relé indicado por el usuario. El proyecto no guarda ni registra intencionadamente la Key, y no la incluye en respuestas ni informes.
- La versión autohospedada escucha en `127.0.0.1` de forma predeterminada. La API Key solo pasa por el navegador del usuario, su servicio RelayAudit local y el relé de destino.
- La versión alojada solo permite direcciones HTTPS públicas y rechaza localhost, direcciones privadas, link-local y reservadas. La versión local puede probar endpoints HTTP o privados según el entorno de red del usuario.
- Confirma que la Base URL pertenece a la plataforma prevista para no enviar la Key a una dirección no fiable.
- No publiques salidas de terminal, capturas de pantalla ni archivos de configuración que contengan Keys reales.
- No publiques el directorio `.vercel`, credenciales de Vercel ni Keys reales.
- Antes de exportar un informe, comprueba que el nombre de la plataforma, el endpoint y la información empresarial sean aptos para su divulgación.
- El texto del corpus personalizado no aparece en las respuestas ni en los informes exportados. El informe solo registra su origen, número de líneas, número de caracteres y SHA-256.
- El historial del navegador solo guarda el modelo, la hora de finalización y el resumen de facturación. No guarda API Keys, URLs de endpoints ni el corpus de prueba, y puede borrarse desde la página.

Consulta [SECURITY.md](SECURITY.md) para ver las instrucciones completas de notificación de vulnerabilidades.

## Desarrollo

```bash
npm test
npm run check
npm run pricing:sync
```

El proyecto utiliza servicios HTTP nativos de Node.js y módulos frontend nativos. Lee [CONTRIBUTING.md](CONTRIBUTING.md) y [CHANGELOG.md](CHANGELOG.md) antes de contribuir.

## Licencia

[MIT](LICENSE) © 2026 Colaboradores de RelayAudit
