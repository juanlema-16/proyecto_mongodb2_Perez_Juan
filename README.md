# Campus Parking — Sistema de Parqueaderos Multisede (MongoDB)

Sistema backend para la gestión de parqueaderos multisede, diseñado sobre
MongoDB. Este repositorio contiene el modelado de datos, la carga de datos
de prueba, las consultas analíticas, el control de acceso por roles y una
transacción multi-documento que garantiza consistencia entre colecciones.

## Tabla de contenido

1. [Introducción al proyecto](#1-introducción-al-proyecto)
2. [Justificación del uso de MongoDB](#2-justificación-del-uso-de-mongodb)
3. [Diseño del modelo de datos](#3-diseño-del-modelo-de-datos)
4. [Validaciones `$jsonSchema`](#4-validaciones-jsonschema)
5. [Índices](#5-índices)
6. [Estructura de los datos de prueba](#6-estructura-de-los-datos-de-prueba)
7. [Explicación de las agregaciones](#7-explicación-de-las-agregaciones)
8. [Transacción MongoDB](#8-transacción-mongodb)
9. [Roles y control de acceso](#9-roles-y-control-de-acceso)
10. [Cómo ejecutar el proyecto](#10-cómo-ejecutar-el-proyecto)
11. [Conclusiones y mejoras posibles](#11-conclusiones-y-mejoras-posibles)

---

## 1. Introducción al proyecto

**Campus Parking** administra parqueaderos ubicados en distintas ciudades.
Antes de este proyecto, cada sede llevaba su información en hojas de cálculo
independientes, lo que generaba:

- Duplicación de datos de clientes y vehículos entre sedes.
- Errores de digitación y falta de una fuente única de verdad.
- Imposibilidad de generar reportes consolidados (ocupación, ingresos,
  clientes frecuentes) sin trabajo manual.
- Riesgo de sobreventa de cupos por falta de control en tiempo real.

Este proyecto migra la operación a una base de datos **MongoDB** centralizada,
con:

- Un modelo de datos documentado y validado (`db_config.js`).
- Datos de prueba realistas para desarrollo y pruebas (`test_dataset.js`).
- Consultas analíticas para la toma de decisiones (`aggregations.js`).
- Seguridad basada en roles (`roles.js`).
- Una transacción ACID que evita inconsistencias entre el registro de
  parqueos y el conteo de cupos disponibles (`transactions.js`).

## 2. Justificación del uso de MongoDB

Se eligió MongoDB (NoSQL orientado a documentos) por las siguientes razones:

- **Flexibilidad de esquema controlada**: cada sede puede tener zonas con
  configuraciones distintas (tipos de vehículo permitidos, tarifas), lo cual
  se modela de forma natural como documentos con arreglos, sin necesidad de
  tablas de unión rígidas. `$jsonSchema` permite mantener flexibilidad sin
  perder control de calidad de los datos.
- **Consultas analíticas potentes con el Aggregation Framework**: reportes
  como "zona más ocupada por sede" o "ingreso total por sede" se resuelven
  con pipelines declarativos (`$group`, `$lookup`, `$sort`), sin necesidad de
  múltiples `JOIN`s complejos.
  ni de un ETL externo.
- **Escalabilidad horizontal**: a medida que Campus Parking abra más sedes,
  MongoDB permite escalar mediante sharding (por ejemplo, usando `sede_id`
  como parte de la shard key) sin rediseñar el modelo.
- **Transacciones ACID multi-documento**: desde MongoDB 4.0+ (con Replica
  Set) es posible garantizar atomicidad entre colecciones relacionadas
  (`parqueos` y `zonas`), cubriendo el requisito de consistencia sin
  sacrificar el modelo de documentos.
- **Documentos que reflejan el dominio**: un "parqueo" es naturalmente un
  evento con inicio y fin; modelarlo como documento evita el sobre-diseño
  relacional para un caso de uso mayormente de lectura/escritura simple por
  documento, mientras las relaciones (cliente, vehículo, sede, zona) se
  manejan por referencia cuando el volumen lo amerita.

## 3. Diseño del modelo de datos

### 3.1 Colecciones creadas

| Colección   | Descripción                                                                 |
|-------------|------------------------------------------------------------------------------|
| `usuarios`  | Administradores, empleados de sede y clientes (un solo esquema polimórfico). |
| `vehiculos` | Vehículos registrados, cada uno asociado a un cliente.                       |
| `sedes`     | Sedes físicas de Campus Parking.                                             |
| `zonas`     | Zonas dentro de cada sede, con capacidad, tarifa y tipos de vehículo.        |
| `parqueos`  | Eventos de ingreso/salida de vehículos (colección transaccional principal). |

### 3.2 Decisiones de referencias vs. documentos embebidos

| Relación                        | Estrategia   | Justificación                                                                                                   |
|----------------------------------|--------------|-------------------------------------------------------------------------------------------------------------------|
| `usuarios` (rol=empleado) → `sedes` | Referencia (`sede_id`) | Un empleado pertenece a una sede, pero la sede no debe conocer ni embeber a sus empleados (evita duplicación y documentos que crecen sin límite). |
| `vehiculos` → `usuarios` (cliente) | Referencia (`cliente_id`) | Un cliente puede tener varios vehículos y cada vehículo genera muchos parqueos; embeber rompería el límite práctico de tamaño de documento (16 MB) a largo plazo. |
| `zonas` → `sedes`                | Referencia (`sede_id`) | Relación 1:N (una sede tiene varias zonas). Se referencia porque las zonas se consultan/actualizan de forma independiente y frecuente (cupos en tiempo real). |
| `parqueos` → `vehiculos`, `usuarios`, `sedes`, `zonas` | Referencia | `parqueos` es la colección de mayor volumen (crece indefinidamente); referenciar evita duplicar los documentos padre y permite agregaciones cruzadas eficientes con `$lookup`. |
| `parqueos.tipo_vehiculo`         | **Desnormalización deliberada** (copia del tipo del vehículo) | Se desnormaliza un solo campo para poder agrupar por tipo de vehículo en reportes (`aggregations.js #5, #7`) sin necesidad de un `$lookup` adicional en consultas de alta frecuencia. |
| `sedes.tipos_vehiculo_permitidos` (arreglo) | Embebido | Es una lista corta y acotada (máx. 4 valores del enum), ideal para embeber directamente como arreglo dentro del documento de sede. |
| `zonas.tipo_vehiculo_permitido` (arreglo) | Embebido | Igual razón: lista corta y acotada por zona. |

**Regla general aplicada:** se embebe cuando el sub-documento es pequeño,
acotado y de crecimiento controlado (listas de tipos permitidos); se
referencia cuando la entidad relacionada crece de forma independiente o
puede alcanzar un volumen alto (empleados, vehículos, parqueos).

## 4. Validaciones `$jsonSchema`

Todas las colecciones se crean con `validator: { $jsonSchema: {...} }`,
`validationLevel: "strict"` y `validationAction: "error"` (ver
`db_config.js`), lo que garantiza que **ningún documento inválido pueda
insertarse o actualizarse**, sin importar si la operación viene de un script,
una aplicación o una consulta manual.

### `usuarios`
- Campos obligatorios: `nombre`, `cedula`, `email`, `rol`, `estado`,
  `fecha_registro`.
- `cedula`: patrón numérico (6 a 15 dígitos) — evita cédulas con formato
  incorrecto.
- `email`: patrón de correo electrónico válido.
- `rol`: restringido a `enum ["administrador", "empleado", "cliente"]`.
- **Regla condicional (`if`/`then`)**: si `rol = "empleado"`, entonces
  `sede_id` pasa a ser obligatorio. Esto modela la regla de negocio "todo
  empleado pertenece a una sede" directamente en el esquema.

### `vehiculos`
- Campos obligatorios: `placa`, `tipo`, `cliente_id`, `fecha_registro`.
- `tipo`: `enum ["carro", "moto", "bicicleta", "camion"]`, alineado con los
  tipos de vehículo soportados en todo el sistema.
- `cliente_id`: tipo `objectId`, referencia al dueño del vehículo.

### `sedes`
- Campos obligatorios: `nombre`, `ciudad`, `direccion`, `capacidad_total`,
  `tipos_vehiculo_permitidos`, `estado`.
- `capacidad_total`: entero, mínimo 1 (una sede no puede existir con
  capacidad 0 o negativa).
- `tipos_vehiculo_permitidos`: arreglo con al menos 1 elemento del enum
  permitido.

### `zonas`
- Campos obligatorios: `sede_id`, `codigo`, `tipo_vehiculo_permitido`,
  `capacidad_maxima`, `cupos_disponibles`, `tarifa_hora`, `estado`.
- `cupos_disponibles`: entero, `minimum: 0` — impide que el sistema registre
  cupos negativos (protección adicional a la lógica de la transacción).
- `tarifa_hora`: numérico, `minimum: 0`.

### `parqueos`
- Campos obligatorios: `vehiculo_id`, `cliente_id`, `sede_id`, `zona_id`,
  `tipo_vehiculo`, `hora_entrada`, `estado`.
- `hora_salida`, `tiempo_total_minutos`, `costo_total`: tipo `["<tipo>",
  "null"]` — permiten valor nulo mientras el vehículo permanece activo, pero
  exigen el tipo correcto (`date`, `int`, `double`) una vez se completan.
- `estado`: `enum ["activo", "finalizado"]`, coherente con la presencia o
  ausencia de `hora_salida`.

## 5. Índices

### Lista de índices creados

| Colección  | Índice                                       | Tipo               |
|------------|-----------------------------------------------|---------------------|
| usuarios   | `{ cedula: 1 }`                                | Único               |
| usuarios   | `{ email: 1 }`                                 | Único               |
| usuarios   | `{ rol: 1, estado: 1 }`                        | Compuesto           |
| usuarios   | `{ sede_id: 1 }`                               | Simple              |
| vehiculos  | `{ placa: 1 }`                                 | Único               |
| vehiculos  | `{ cliente_id: 1 }`                            | Simple              |
| vehiculos  | `{ tipo: 1 }`                                  | Simple              |
| sedes      | `{ nombre: 1 }`                                | Único               |
| sedes      | `{ ciudad: 1 }`                                | Simple              |
| zonas      | `{ sede_id: 1, codigo: 1 }`                    | Compuesto único     |
| zonas      | `{ sede_id: 1, estado: 1 }`                    | Compuesto           |
| parqueos   | `{ vehiculo_id: 1 }`                           | Simple              |
| parqueos   | `{ cliente_id: 1, hora_entrada: -1 }`          | Compuesto           |
| parqueos   | `{ sede_id: 1, zona_id: 1, estado: 1 }`        | Compuesto           |
| parqueos   | `{ sede_id: 1, hora_entrada: -1 }`             | Compuesto           |
| parqueos   | `{ estado: 1 }`                                | Simple              |
| parqueos   | `{ sede_id: 1, tipo_vehiculo: 1 }`             | Compuesto           |

### Justificación técnica

- **Índices únicos (`cedula`, `email`, `placa`, `nombre` de sede)**: aplican
  a nivel de base de datos la regla de negocio de unicidad, evitando
  duplicados aunque falle una validación en la capa de aplicación.
- **`usuarios.{rol, estado}`**: soporta consultas muy frecuentes como
  "listar todos los clientes activos" o "listar empleados activos de una
  sede", evitando escaneos completos de colección (`COLLSCAN`).
- **`zonas.{sede_id, codigo}` (único)**: refleja la regla "dentro de una
  sede no puede repetirse el código de zona" y acelera la búsqueda de una
  zona específica de una sede.
- **`parqueos.{cliente_id, hora_entrada: -1}`**: optimiza el caso de uso
  "historial de parqueos de un cliente ordenado del más reciente al más
  antiguo" (agregación #6), que de otra forma requeriría ordenar en memoria.
- **`parqueos.{sede_id, zona_id, estado}` y `{sede_id, hora_entrada: -1}`**:
  soportan directamente los reportes de ocupación por sede/zona y los
  reportes de "último mes" (agregaciones #1 y #2), permitiendo que Mongo
  resuelva el `$match` inicial usando el índice antes de agrupar.
- **`parqueos.estado`**: acelera la consulta más frecuente del día a día
  operativo: "¿qué vehículos están actualmente parqueados?" (agregación #7)
  y el chequeo de disponibilidad en tiempo real.
- **`parqueos.{sede_id, tipo_vehiculo}`**: soporta el reporte de "tipo de
  vehículo más frecuente por sede" (agregación #5).

## 6. Estructura de los datos de prueba

`test_dataset.js` genera datos coherentes y referencialmente consistentes:

- **3 sedes** en ciudades distintas de Guatemala: Ciudad de Guatemala,
  Quetzaltenango y Antigua Guatemala.
- **5 zonas por sede** (15 en total), cada una con tipo(s) de vehículo
  permitido, capacidad máxima, tarifa por hora y cupos disponibles.
- **2 administradores**, **10 empleados** (distribuidos entre las 3 sedes) y
  **15 clientes**, todos en la colección `usuarios`, diferenciados por `rol`.
- **30 vehículos** (14 carros, 8 motos, 5 bicicletas, 3 camiones),
  distribuidos entre los 15 clientes.
- **50 registros de parqueos**, distribuidos en los últimos 45 días,
  asignados a zonas compatibles con el tipo de cada vehículo. **10 quedan
  activos** (sin `hora_salida`, simulando vehículos actualmente estacionados)
  y 40 quedan finalizados con `tiempo_total_minutos` y `costo_total`
  calculados.
- Al final del script se recalculan los `cupos_disponibles` de cada zona en
  función de los parqueos que quedaron activos, manteniendo la consistencia
  que luego se preserva transaccionalmente en operación normal
  (`transactions.js`).

## 7. Explicación de las agregaciones

Todas las consultas están implementadas y comentadas en `aggregations.js`:

1. **Parqueos por sede en el último mes**: `$match` por rango de fecha +
   `$group` por `sede_id` + `$lookup` para mostrar el nombre de la sede.
2. **Zona más ocupada por sede**: doble `$group` (primero
   sede+zona, luego por sede tomando el máximo con `$sort` + `$first`).
3. **Ingreso total por sede**: `$match` de parqueos finalizados + `$group`
   con `$sum` sobre `costo_total`.
4. **Cliente más frecuente**: `$group` por `cliente_id`, `$sort` descendente
   y `$limit: 1`.
5. **Tipo de vehículo más frecuente por sede**: mismo patrón de doble
   `$group` que la pregunta 2, pero agrupando por tipo de vehículo.
6. **Historial de un cliente**: `$match` por `cliente_id` (resuelto primero
   por cédula), `$lookup` a `sedes` y `zonas`, `$project` con los campos
   solicitados (fecha, sede, zona, tipo, tiempo, costo).
7. **Vehículos parqueados actualmente por sede**: `$match` de `estado:
   "activo"`, `$lookup` a `vehiculos`, `$group` por sede con `$push` de los
   vehículos activos.
8. **Zonas que excedieron su capacidad**: agrupa ingresos por zona y día
   (`$dateTrunc`), compara contra `capacidad_maxima` de la zona con `$expr`
   dentro de `$match`. *(Se documenta explícitamente la limitación: al no
   guardar una foto histórica minuto a minuto de ocupación concurrente, se
   usa como aproximación el conteo de ingresos por día calendario vs.
   capacidad máxima).*

## 8. Transacción MongoDB

### Escenario utilizado

Registrar el **ingreso de un vehículo** debe:
1. Insertar un documento en `parqueos` con `estado: "activo"`.
2. Disminuir en 1 el campo `cupos_disponibles` de la `zona` correspondiente.

Ambas operaciones deben ocurrir de forma atómica: si no hay cupo disponible,
**no debe crearse el parqueo**; si el parqueo no puede insertarse, **no debe
descontarse el cupo**.

También se implementó el flujo inverso (registrar la **salida**), que
calcula el costo y libera el cupo, para demostrar un ciclo completo.

### Código explicado paso a paso (`transactions.js`)

1. `db.getMongo().startSession(...)` abre una sesión de cliente.
2. `session.startTransaction({ readConcern: "snapshot", writeConcern:
   {w:"majority"} })` inicia la transacción con un nivel de aislamiento
   consistente (lectura tipo "foto" del momento de inicio) y garantía de
   durabilidad (mayoría del replica set).
3. Se valida, dentro de la transacción, que el vehículo y la zona existan,
   que la zona esté activa y que admita el tipo de vehículo.
4. **Paso A**: `zonas.updateOne({ _id, cupos_disponibles: { $gt: 0 } }, {
   $inc: { cupos_disponibles: -1 } })`. El filtro `$gt: 0` hace que la
   actualización sea atómica y evita condiciones de carrera entre ingresos
   simultáneos (nunca se resta de un valor que ya esté en 0).
5. Si `modifiedCount === 0` (no había cupo), se lanza un error que interrumpe
   el flujo **antes** de insertar el parqueo.
6. **Paso B**: `parqueos.insertOne(nuevoParqueo, { session })` inserta el
   registro de ingreso, siempre dentro de la misma sesión/transacción.
7. Si todo fue exitoso: `session.commitTransaction()` hace permanentes ambos
   cambios de forma atómica.
8. Si ocurre cualquier error: bloque `catch` con `session.abortTransaction()`
   (rollback completo — ningún cambio parcial queda persistido).
9. `finally { session.endSession() }` cierra siempre la sesión, haya o no
   habido error.

El script incluye además una **demostración de rollback**: intenta registrar
un ingreso en una zona con `cupos_disponibles: 0` y confirma que la
transacción se aborta sin crear el parqueo ni modificar la zona.

## 9. Roles y control de acceso

Definidos en `roles.js` mediante `db.createRole()` y usuarios de ejemplo
creados con `db.createUser()` / `db.grantRolesToUser()`.

### Descripción de cada rol

| Rol de MongoDB   | Corresponde a...        | Permisos                                                                                                   |
|-------------------|--------------------------|--------------------------------------------------------------------------------------------------------------|
| `administrador`   | Administrador del sistema | Lectura y escritura total sobre las 5 colecciones, más `dbAdmin` para gestión de índices/colecciones.        |
| `empleado_sede`   | Empleado de sede         | Solo lectura de `usuarios` (clientes) y `vehiculos`. Lectura de `sedes`. Lectura/escritura de `parqueos` (registrar ingresos/salidas) y `zonas` (actualizar cupos). |
| `cliente_app`     | Cliente                  | Solo lectura de `sedes`, `zonas` (disponibilidad/tarifas), `parqueos` y `vehiculos` — sin permisos de escritura. La restricción a "solo su propia información" se aplica en la capa de aplicación filtrando siempre por `cliente_id`, ya que MongoDB Community no ofrece seguridad nativa a nivel de documento. |

### Ejemplo de creación de usuarios con esos roles

```js
// Administrador
db.createUser({
  user: "admin_mariana",
  pwd: "CambiarPassword123!",
  roles: [{ role: "administrador", db: "campus_parking" }]
});

// Empleado de sede
db.createUser({
  user: "empleado_ana_guatemala",
  pwd: "CambiarPassword123!",
  roles: [{ role: "empleado_sede", db: "campus_parking" }]
});

// Cliente
db.createUser({
  user: "cliente_andrea",
  pwd: "CambiarPassword123!",
  roles: [{ role: "cliente_app", db: "campus_parking" }]
});

// Asignar un rol adicional a un usuario ya existente
db.grantRolesToUser("empleado_ana_guatemala", [
  { role: "empleado_sede", db: "campus_parking" }
]);
```

> ⚠️ Las contraseñas en `roles.js` son solo de ejemplo para el entorno de
> pruebas y deben rotarse/gestionarse mediante un vault de secretos antes de
> usarse en un ambiente productivo.

## 10. Cómo ejecutar el proyecto

Requisitos: MongoDB 6.0+ desplegado como **Replica Set** (necesario para
`transactions.js`), y `mongosh` instalado.

```bash
# 1. Crear colecciones, validaciones e índices
mongosh "mongodb://<host>/campus_parking" db_config.js

# 2. Poblar con datos de prueba
mongosh "mongodb://<host>/campus_parking" test_dataset.js

# 3. Ejecutar las consultas analíticas
mongosh "mongodb://<host>/campus_parking" aggregations.js

# 4. Crear roles y usuarios (requiere privilegios de userAdmin)
mongosh "mongodb://<host>/admin" -u <admin_user> -p roles.js

# 5. Ejecutar la demostración de transacciones
mongosh "mongodb://<host>/campus_parking" transactions.js
```

## 11. Conclusiones 

**Conclusiones**

- El modelo de documentos con referencias selectivas permite representar de
  forma natural la jerarquía Sede → Zona → Parqueo, manteniendo consultas
  analíticas eficientes gracias al Aggregation Framework.
- `$jsonSchema` cubre la mayoría de las reglas de negocio (tipos, enums,
  campos obligatorios, condicionales) directamente en la base de datos,
  reduciendo la responsabilidad de validación en la capa de aplicación.
- Las transacciones multi-documento de MongoDB permiten resolver, con
  garantías ACID, el problema central del negocio: nunca permitir que un
  vehículo "ingrese" sin descontar un cupo real, ni descontar un cupo sin
  registrar el ingreso correspondiente.
- El modelo de roles (`administrador`, `empleado_sede`, `cliente_app`) cubre
  los 3 perfiles solicitados, dejando explícito qué controles deben
  reforzarse en la capa de aplicación (filtrado por documento).


