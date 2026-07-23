db.sedes.deleteMany({});

db.sedes.insertMany([
    {
      _id: 1,
      nombre: "Sede Zona 10",
      ciudad: "Ciudad de Guatemala",
      departamento: "Guatemala",
      direccion: "12 Avenida 15-30, Zona 10",
      telefono: "23856710",
      capacidad_maxima: 130,
      activa: true
    },

    {
        _id:2,
        nombre: "sede zona 1",
        ciudad: "ciudad de antigua",
        departamento: "Antigua",
        direccion: "5 avenida 10-40, zona 1",
        telefono: "87874545",
        capacidad_maxima:190,
        activa: true
    },

    {
        _id:3,
        nombre: "sede zona 12",
        ciudad: "ciudad de guatemala",
        departamento: "Guatemala",
        direccion: "1 avenida 20-30, zona 12",
        telefono: "41805001",
        capacidad_maxima:200,
        activa: true
    },

    {
        _id:4,
        nombre: "sede zona 1",
        ciudad: "ciudad de antigua",
        departamento: "Antigua",
        direccion: "15 avenida 89-15, zona 1",
        telefono: "41607001",
        capacidad_maxima:110,
        activa: true
    },

    {
        _id:5,
        nombre: "sede zona 10",
        ciudad: "ciudad de fuatemala",
        departamento: "Guatemala",
        direccion: "20 avenida 18-13, zona 10",
        telefono: "41607889",
        capacidad_maxima:160,
        activa: true
    },

    {
        _id:6,
        nombre: "sede zona 12",
        ciudad: "ciudad de guatemala",
        departamento: "Reformita",
        direccion: "3 avenida 33-63, zona 12",
        telefono: "54167089",
        capacidad_maxima:170,
        activa: true
    }



  ]);


db.usuarios.delemany({});

db.sedes.insertMany([
    nombre: "Juan Perez",
    cedula: "298868474",
    correo: "juanperez@gmail.com",
    telefono: "88889898",
    tipo_usuario: "administrador",
    sede_id: 1,
    activa: true
])

db.sedes.insertMany([
    nombre: "jose ",
    cedula: "298868474",
    correo: "juanperez@gmail.com",
    telefono: "88889898",
    tipo_usuario: "administrador",
    sede_id: 1,
    activa: true
])

db.sedes.insertMany([
    nombre: "Juan Perez",
    cedula: "298868474",
    correo: "juanperez@gmail.com",
    telefono: "88889898",
    tipo_usuario: "administrador",
    sede_id: 1,
    activa: true
])

