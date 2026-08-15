---
translated_from_hash: PLACEHOLDER
sync_version: 1
---

**Idiomas**: [English](README.md) · [한국어](README_ko.md) · [Español](README_es.md) · [日本語](README_ja.md)

---

# Estándares del Espacio de Trabajo de IA (AI Workspace Standards)

> **Configuración maestra para Vibe Coding y Harness Engineering en todas las herramientas de codificación de IA.**

Este repositorio define los estándares compartidos del espacio de trabajo utilizados por cada proyecto bajo la raíz del workspace. Está diseñado para ser clonado directamente como la raíz del espacio de trabajo (`C:\git` en Windows · `~/git` en macOS/Linux) para que todos los proyectos hereden automáticamente el mismo comportamiento de la IA, flujo de trabajo y reglas de calidad.

---

## ¿Qué es esto?

El desarrollo moderno asistido por IA requiere más que simples prompts; requiere **contratos de comportamiento consistentes y obligatorios** que cada herramienta de IA siga en cada proyecto. Este repo proporciona:

| Interés | Archivo | Audiencia |
|---------|------|----------|
| Estándares compartidos del workspace | [`CONSTITUTION.md`](CONSTITUTION.md) | Todas las herramientas de IA |
| Comportamientos de Claude Code | [`CLAUDE.md`](CLAUDE.md) | Claude Code (CLI + Desktop) |
| Comportamientos de Gemini / Antigravity | [`GEMINI.md`](GEMINI.md) | Gemini CLI + motor Antigravity |
| Historial de cambios | [`CHANGELOG.md`](CHANGELOG.md) | Todos |

### Dos Filosofías, Un Estándar

**Vibe Coding** - La IA toma el volante. El desarrollador describe la intención; los agentes de IA (PM $\rightarrow$ Arquitecto $\rightarrow$ Diseñador $\rightarrow$ Programador $\rightarrow$ Ejecutor de Pruebas) ejecutan el flujo de trabajo completo de forma autónoma. Estos estándares definen las barreras de seguridad que mantienen la ejecución autónoma segura y auditable.

**Harness Engineering** - El desarrollador permanece en el ciclo. Las herramientas de IA son instrumentos de precisión: ediciones quirúrgicas, planes explícitos, puertas de revisión obligatorias. Estos estándares definen el "arnés" (harness) que mantiene la salida de la IA predecible y revisable.

---

## Prerrequisitos

**Antes de usar este espacio de trabajo**, asegúrese de tener instalado el software requerido:

> **📖 Guía Detallada**: Vea [Primeros Pasos](docs/getting-started.md) para obtener instrucciones completas de instalación y solución de problemas.

### Herramientas Imprescindibles

| Herramienta | Versión | Propósito | Instalación |
|------|---------|---------|---------|
| **Git** | 2.x+ | Control de versiones, automatización de hooks | [git-scm.com](https://git-scm.com/downloads) |
| **Bun** ⭐ | 1.x+ | Scripts de TypeScript, creación de proyectos (REQUERIDO) | `curl -fsSL https://bun.sh/install \| bash` |

**CAMBIO IMPORTANTE**: Bun ahora es **obligatorio** para la creación de proyectos (reemplaza el código inline de Python/PowerShell).

### Herramientas Opcionales

| Herramienta | Propósito | Instalación |
|------|---------|---------|
| **GitHub CLI (gh)** | Automatización de PR | [cli.github.com](https://cli.github.com/) |

### Verificación Rápida

```bash
# Verificar herramientas esenciales
git --version    # Debería mostrar 2.x.x
bun --version    # Debería mostrar 1.x.x
gh --version     # Opcional: automatización de PR
```

**Instalar herramientas faltantes**: Vea [Primeros Pasos](docs/getting-started.md#-essential-software-must-have) para instrucciones detalladas de instalación.

---

## Inicio Rápido

### 0. Instalar prerrequisitos (si aún no están instalados)

```bash
# Instalar Bun (REQUERIDO) — https://bun.sh/docs/installation
curl -fsSL https://bun.sh/install | bash   # Unix/Linux/macOS
powershell -c "irm bun.sh/install.ps1 | iex"  # Windows

# Verificar instalación
git --version
bun --version
```

> **Nota**: `scripts/install-bun.sh` e `install-bun.ps1` han sido eliminados. Instale Bun directamente desde [bun.sh](https://bun.sh) antes de usar cualquier script del espacio de trabajo.

### 1. Clonar como raíz del espacio de trabajo

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git

# macOS / Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
```

### 2. Abrir Claude Code

```bash
claude
```

> Los hooks de Git (`.githooks/`) se configuran automáticamente al iniciar la primera sesión de Claude a través del hook `SessionStart` en `.claude/settings.json`; no es necesario realizar `git config` manual.

### 3. Crear tu primer proyecto

```bash
# Predeterminado (última plantilla, variante co-develop) — todas las plataformas
bun scripts/new-project.ts "nombre-de-mi-proyecto"

# Especificar una variante
bun scripts/new-project.ts "nombre-de-mi-proyecto" --variant co-develop

# Usar una versión específica de la plantilla (ver disponibles: bun scripts/list-template-versions.ts)
bun scripts/new-project.ts "nombre-de-mi-proyecto" --version 0.5.0
```

> **[Cambio Importante — 11-06-2026]**: `bash scripts/new-project.sh` y `.\scripts\new-project.ps1` han sido reemplazados por `bun scripts/new-project.ts` (ADR-0036). Actualice cualquier alias o tubería de CI en consecuencia.

> **Atajo de herramienta de IA**: En Claude Code, use `/new-project "nombre-de-mi-proyecto"` en lugar de ejecutar el script directamente.

Cada nuevo proyecto se genera a partir de la variante de plantilla seleccionada con `docs/context.md`, `AGENTS.md`, `agents/pm.md` y todos los archivos de configuración requeridos. La versión de la plantilla y la variante se registran en `docs/context.md` para fines de trazabilidad.

### 4. Moverse al nuevo proyecto e Iniciar el Kick-off del PM

**CRÍTICO**: Debe salir de su sesión de IA actual e iniciar una nueva dentro del directorio del proyecto recién creado. Si permanece en la raíz del espacio de trabajo, la IA no cargará la configuración específica del proyecto y omitirá la reunión de kick-off.

**Proporcione Contexto para Mejores Resultados**

El agente PM funciona mejor cuando proporciona un contexto claro:
1. **Objetivo del proyecto** - Qué está construyendo
2. **Sugerencia de equipo de agentes** (opcional) - Agentes especializados sugeridos
3. **Resultado esperado** - Plan de implementación, diseño, código

```bash
# 1. Salir de la sesión de IA actual (si se está ejecutando)
# 2. Moverse a la carpeta del proyecto recién creado
cd "nombre-de-mi-proyecto"

# 3. Iniciar una nueva sesión de IA para cargar el contexto del proyecto
claude
# o
agy
```

**Ejemplo: Construyendo un Juego de Tetris**

```
> "Construye un juego de Tetris en TypeScript. Configura un equipo de agentes
> especializados (game-design para mecánicas, game-logic para detección de colisiones, 
> graphics para renderizado, qa para pruebas) e inicia la reunión de kick-off 
> para crear un plan de implementación."
```

Esto le da al agente PM un contexto claro para:
- Entender sus requerimientos específicos
- Configurar el equipo de agentes adecuado (predeterminado o personalizado)
- Generar una agenda de kick-off enfocada
- Presentar un plan concreto para su aprobación

---

## Estructura del Repositorio

```
C:\git\ (raíz del workspace - este repo)
├── CONSTITUTION.md          # Estándar maestro - leer primero en cada sesión
├── CLAUDE.md                # Comportamientos del workspace para Claude Code
├── GEMINI.md                # Comportamientos del workspace para Gemini CLI / Antigravity
├── SECURITY.md              # Política estándar de reporte de vulnerabilidades de GitHub
├── CHANGELOG.md             # Historial de cambios a nivel de workspace
├── README.md                # Este archivo
├── README_ko.md             # Este archivo (Coreano)
├── memory/                  # Logs de memoria a nivel de workspace
├── agents/                  # Agentes especialistas a nivel de workspace
├── skills/                  # Habilidades reutilizables a nivel de workspace
├── tests/                   # Suites de pruebas de integración y unitarias
├── scripts/                 # Scripts principales de automatización y auditoría
├── .githooks/               # Git hooks para hacer cumplir políticas de PR y reglas
├── .claude/ & .gemini/      # Configuraciones globales de herramientas de IA y comandos slash personalizados
└── templates/               # Plantillas de proyectos de IA versionadas (co-develop, co-design, etc.)
    ├── common/              # Scripts, hooks y habilidades compartidas entre todas las variantes
    ├── co-develop/          # ✅ Estable — equipo de agentes para desarrollo completo de software
    ├── co-design/           # ✅ Estable — equipo de agentes especializado en diseño UI/UX
    ├── co-work/             # ✅ Estable — equipo de agentes para colaboración general y documentación
    ├── co-security/         # ✅ Estable — equipo de agentes para red team y modelado de amenazas
    ├── co-consult/          # ✅ Estable — equipo de agentes para consultoría estratégica y análisis
    ├── co-deck/             # 🔶 Beta — equipo de agentes para producción de material de lectura y presentaciones
    └── co-game/             # ✅ Estable — equipo de agentes para desarrollo de juegos en HTML5 Canvas
```

Cada subproyecto vive en su propio directorio y repositorio git:

```
C:\git\
├── mi-proyecto\              # Repo git independiente
│   ├── docs/context.md      # Conocimiento del proyecto (todas las herramientas de IA)
│   ├── AGENTS.md            # Índice de agentes
│   ├── CLAUDE.md            # Sobrescrituras de Claude Code a nivel de proyecto
│   └── GEMINI.md            # Sobrescrituras de Gemini a nivel de proyecto
└── otro-proyecto\           # Otro repo git independiente
```

---

## Lista de Verificación de Inicio de Sesión

Cada sesión de IA comienza ejecutando esta lista de verificación (definida en `CONSTITUTION.md`):

0. `git config core.hooksPath .githooks`
1. Leer `CONSTITUTION.md` (estándar de este workspace)
2. Leer `docs/context.md` del proyecto
3. Leer `AGENTS.md` (plantilla canónica de agentes)
4. Revisar `memory/MEMORY.md` para cambios recientes
5. Cargar habilidades desde `docs/context.md ## Session Start Skills`

---

## Flujo de Trabajo Multi-Agente

Cada variante de plantilla en este workspace proporciona un **flujo de trabajo multi-agente y equipo de agentes** altamente optimizado y especializado para su propósito específico.

- **co-develop**: Un pipeline de gobernanza lineal de 6 fases para el desarrollo y verificación de software.
- **co-design**: Un flujo de trabajo nativo de diseño iterativo de 5 fases enfocado en el prototipado rápido y la validación continua del usuario.
- **co-work**: Un flujo de trabajo de colaboración asíncrona de 6 fases enfocado en la redacción paralela y la revisión continua de los stakeholders.
- **co-security**: Un flujo de trabajo de compromiso de seguridad de 6 fases que cubre operaciones de Red Team, modelado de amenazas y automatización de parches basada en Ansible.
- **co-consult**: Un flujo de trabajo de consultoría estratégica de 7 fases que cubre investigación, análisis, creación de entregables y entrega al cliente.
- **co-deck**: Un flujo de trabajo de producción de material de lectura de 11 etapas, desde la investigación hasta el PDF listo para imprimir, con 5 puertas de aprobación.
- **co-game**: Un flujo de trabajo de desarrollo de juegos para juegos de HTML5 Canvas usando Vanilla TypeScript, con agentes especializados en diseño de juegos, géneros arcade/puzzle, arte visual, sonido, implementación del motor, depuración y pruebas.

**💡 Cómo revisar los detalles del flujo de trabajo**
Las plantillas de agentes específicas y las fases de gobernanza se gestionan dentro de los documentos de cada proyecto generado. Después de crear un proyecto, revise:
1. `AGENTS.md`: La especificación completa de los roles y permisos de los agentes desplegados en el proyecto.
2. `docs/context.md`: El objetivo del proyecto y el contexto del flujo de trabajo para el inicio de la sesión.

---

## Variantes de Plantillas

Los nuevos proyectos se generan a partir de variantes de plantillas versionadas. Las plantillas están etiquetadas en git como `template-vX.Y.Z`.

| Variante | Estado | Descripción |
|---------|--------|-------------|
| `co-develop` | ✅ Estable | Flujo de desarrollo de software completo — PM, Arquitecto, Diseñador, Programador, Ejecutor de Pruebas, Monitor de Seguridad |
| `co-design` | ✅ Estable | Flujo de diseño UI/UX — PM, Líder de Diseño, Investigador de UX, Diseñador Visual, Ingeniero de Prototipos, Storyteller, Diseñador de Servicios, Experto en Tipografía |
| `co-work` | ✅ Estable | Flujo de colaboración general — PM, Analista, Redactor Técnico, Redactor de Contenido, Coordinador de Proyecto, Storyteller, Experto en MS365 |
| `co-security` | ✅ Estable | Flujo de compromiso de seguridad — PM, Líder de Red Team, Pentester, Modelador de Amenazas, Ingeniero de Parches, Redactor de Informes |
| `co-consult` | ✅ Estable | Flujo de consultoría estratégica — Líder de Compromiso, Analista de Estrategia, Experto en la Industria, Socio de Gestión del Cambio, Líder de Comunicaciones, Arquitecto de Soluciones, y más |
| `co-deck` | 🔶 Beta | Flujo de producción de material de lectura — PM, Versión, Investigación, Guion, Diseño, Construcción, Medición, Exportación |
| `co-game` | ✅ Estable | Flujo de desarrollo de juegos HTML5 Canvas — PM, Diseñador de Juegos, Diseñadores Arcade/Puzzle, Artista Visual, Diseñador de Sonido, Desarrollador de Juegos, Depurador de Juegos, Ejecutor de Pruebas, Monitor de Seguridad |

### Selección de versión y variante

```bash
# Listar versiones de plantillas disponibles
bun scripts/list-template-versions.ts

# Usar la plantilla más reciente (predeterminado)
bun scripts/new-project.ts mi-proyecto

# Usar una versión específica
bun scripts/new-project.ts mi-proyecto --version 0.5.0

# Usar una variante específica
bun scripts/new-project.ts mi-proyecto --variant co-develop
```

### Validación de plantillas

Al modificar archivos de plantillas, ejecute el validador de ciclo de vida para detectar problemas estructurales:

```bash
bun scripts/validate-templates.ts
```

Verifica: completitud del frontmatter del agente, secciones requeridas (`## Meeting Participation`, `## Dispatch Protocol`), paridad del roster en AGENTS.md y advertencias de sincronización de archivos compartidos. También se ejecuta automáticamente vía pre-commit cuando se preparan archivos en `templates/`.

---

## Principios de Diseño

- **`docs/context.md` es la única fuente de verdad** para cada proyecto; todas las herramientas de IA lo comparten.
- **`CLAUDE.md` / `GEMINI.md` (a nivel de proyecto) contienen solo sobrescrituras específicas de la plataforma.**
- **Flujo de trabajo solo mediante PR** - todos los cambios llegan a `main` a través de un Pull Request. El push directo está bloqueado por `.githhooks/pre-push`.
- **Conventional Commits** - `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **Scripts solo en TypeScript** - todos los archivos en `scripts/` son `.ts` ejecutados vía `bun` (ADR-0036). No hay pares `.sh/.ps1`.
- **Las Guías de Codificación son auditadas** - `audit.ts` falla la compilación si falta `## Coding Guidelines` en `docs/context.md`.
- **Andamiaje Seguridad-Primero** - Los proyectos están equipados automáticamente con detección de secretos (`.gitleaks.toml`), `SECURITY.md` y hooks de pre-commit seguros para evitar fugas de credenciales.

---

## 📚 Recursos de Aprendizaje (Learning Resources)

Un manual educativo completo está disponible para los profesionales que deseen dominar el flujo de trabajo multi-agente de este espacio de trabajo:

**[Manual de Multi-Agent Harness Engineering](https://5throck.github.io/multi-agent-harness-handbook/)**

Este manual es un programa intensivo de 2 días que cubre:
- **Día 1 — Usuarios Generales**: Conceptos fundamentales de IA, principios de Vibe Coding vs. Harness Engineering, salvaguardas, modelos de permisos y operaciones básicas multi-agente.
- **Día 2 — Profesionales de TI**: Arquitectura detallada (jerarquía SSOT L0→L1→L2), estrategias de despliegue empresarial, ingeniería de variantes personalizadas (Fase A/B) y proyectos finales integrales.

Todos los conceptos se demuestran en cuatro plataformas principales (Claude Code, Claude Desktop App, Antigravity CLI y Antigravity 2.0).

---

## Contribuciones

Este es un **repositorio público**. Las contribuciones son bienvenidas a través de pull requests.

1. Crea una rama desde `main` usando la convención de nomenclatura: `feat/<slug>`, `fix/<slug>`, o `docs/<slug>`
2. Todos los PR deben pasar `bun scripts/audit.ts`
3. Agrega una entrada en `CHANGELOG.md` bajo `[Unreleased]` antes de fusionar
4. Sigue `CONSTITUTION.md §8 - Coding Behavior Guidelines`
5. Se requiere al menos **1 revisión aprobada** antes de fusionar

---

## Licencia

AGPL-3.0 - ver [LICENSE](LICENSE)

---

*Mantenido por [@5throck](https://github.com/5throck) · Última Actualización: 08-07-2026*
