// Content for the chronicle. Everything the page says about each storage medium
// lives here: the chapter text, the card in the collection and the modal's spec sheet.

export type Layout = 'right' | 'left' | 'top'

export type ShapeId =
  | 'hero'
  | 'byte'
  | 'floppy8'
  | 'hdd'
  | 'floppy35'
  | 'cd'
  | 'dvd'
  | 'usb'
  | 'cloud'

/** Morph order of the point cloud, top to bottom of the page. */
export const SHAPE_ORDER: ShapeId[] = [
  'hero',
  'byte',
  'floppy8',
  'hdd',
  'floppy35',
  'cd',
  'dvd',
  'usb',
  'cloud',
]

export interface Spec {
  label: string
  value: string
}

export interface StorageItem {
  id: Exclude<ShapeId, 'hero' | 'byte'>
  numeral: string
  name: string
  cardName: string
  year: number
  family: string
  maker: string
  capacity: string
  equivalence: string
  /** Where the 3D object sits; the text takes the other side. */
  layout: Layout
  lead: string
  summary: string
  how: string[]
  specs: Spec[]
  materials: string[]
  fact: string
}

export const INTRO = {
  eyebrow: 'Prólogo · El bit',
  title: 'Todo empieza con un bit',
  body:
    'Un bit es la respuesta más pequeña posible: sí o no, 1 o 0. Ocho bits forman un byte, suficiente para una letra. Esta es la «S» de Shongo: 01010011. La historia del almacenamiento es la historia de cómo guardar más bits, en menos espacio, durante más tiempo.',
}

export const STORAGE: StorageItem[] = [
  {
    id: 'floppy8',
    numeral: 'I',
    name: 'Disquete de 8 pulgadas',
    cardName: 'Disquete 8″',
    year: 1971,
    family: 'Magnético',
    maker: 'IBM',
    capacity: '≈ 80 KB',
    equivalence: '≈ 40 páginas de texto',
    layout: 'right',
    lead:
      'IBM necesitaba una forma barata de cargar instrucciones en sus mainframes System/370. La respuesta fue un disco de plástico flexible, recubierto de óxido de hierro y guardado en una funda cuadrada.',
    summary:
      'El primer disco flexible: una lámina magnética dentro de una funda de 20 cm que se doblaba en la mano.',
    how: [
      'Un disco de Mylar recubierto de óxido de hierro gira a 360 rpm dentro de su funda.',
      'Un cabezal electromagnético toca la superficie por la ventana ovalada y orienta las partículas magnéticas.',
      'Cada orientación, norte o sur, se lee de vuelta como un 0 o un 1.',
    ],
    specs: [
      { label: 'Capacidad', value: '≈ 80 KB (IBM 23FD, solo lectura)' },
      { label: 'Tamaño', value: '203 × 203 mm (8 pulgadas)' },
      { label: 'Velocidad de giro', value: '360 rpm' },
      { label: 'Tecnología', value: 'Magnética, cabezal en contacto' },
      { label: 'Creador', value: 'IBM, equipo de David L. Noble' },
    ],
    materials: ['Mylar (poliéster PET)', 'Óxido de hierro', 'Funda de PVC', 'Forro de tela antipolvo'],
    fact: 'Se le llamó «floppy» porque, literalmente, se doblaba.',
  },
  {
    id: 'hdd',
    numeral: 'II',
    name: 'Disco duro ST-506',
    cardName: 'Disco duro ST-506',
    year: 1980,
    family: 'Magnético',
    maker: 'Shugart Technology (hoy Seagate)',
    capacity: '5 MB',
    equivalence: '≈ 2.500 páginas de texto',
    layout: 'left',
    lead:
      'El primer disco duro del tamaño de una disquetera de 5,25 pulgadas llevó el almacenamiento rígido a los computadores personales. Costaba unos 1.500 dólares.',
    summary:
      'Platos rígidos girando a 3.600 rpm, del tamaño de una disquetera: el disco duro llega al escritorio.',
    how: [
      'Platos rígidos de aluminio con recubrimiento magnético giran a 3.600 rpm.',
      'Los cabezales vuelan sobre un colchón de aire de micras, sin tocar el plato.',
      'Un brazo actuador salta entre pistas concéntricas para leer y escribir en milisegundos.',
    ],
    specs: [
      { label: 'Capacidad', value: '5 MB formateado' },
      { label: 'Formato', value: '5,25 pulgadas, altura completa' },
      { label: 'Velocidad de giro', value: '3.600 rpm' },
      { label: 'Interfaz', value: 'ST-506, 5 Mbit/s' },
      { label: 'Precio de lanzamiento', value: '≈ USD 1.500' },
    ],
    materials: ['Platos de aluminio', 'Recubrimiento de óxido de hierro', 'Carcasa de aluminio fundido', 'Motor paso a paso'],
    fact: 'Su interfaz fue tan popular que «ST-506» se volvió un estándar de la industria durante años.',
  },
  {
    id: 'floppy35',
    numeral: 'III',
    name: 'Disquete de 3,5 pulgadas',
    cardName: 'Disquete 3,5″',
    year: 1981,
    family: 'Magnético',
    maker: 'Sony',
    capacity: '1,44 MB',
    equivalence: '≈ 700 páginas de texto',
    layout: 'top',
    lead:
      'Sony encerró el disco magnético en una carcasa rígida con una persiana metálica. Cabía en el bolsillo de una camisa y se convirtió en el símbolo de «guardar» durante décadas.',
    summary:
      'Carcasa rígida, persiana metálica y bolsillo de camisa: el ícono de «guardar» que todavía usamos.',
    how: [
      'La persiana metálica se desliza al insertarlo y solo expone el disco dentro de la unidad.',
      'El disco gira a 300 rpm mientras dos cabezales, uno por cara, leen ambas superficies.',
      'Una pestaña deslizable bloquea la escritura: un interruptor físico de solo lectura.',
    ],
    specs: [
      { label: 'Capacidad', value: '1,44 MB (alta densidad, 1987)' },
      { label: 'Dimensiones', value: '90 × 94 × 3,3 mm' },
      { label: 'Velocidad de giro', value: '300 rpm' },
      { label: 'Tecnología', value: 'Magnética, doble cara' },
      { label: 'Creador', value: 'Sony' },
    ],
    materials: ['Carcasa de plástico ABS', 'Persiana metálica con resorte', 'Disco de Mylar con óxido magnético', 'Buje central de acero'],
    fact: 'El ícono de «guardar» de casi todos los programas sigue siendo este disquete.',
  },
  {
    id: 'cd',
    numeral: 'IV',
    name: 'CD-ROM',
    cardName: 'CD-ROM',
    year: 1985,
    family: 'Óptico',
    maker: 'Sony y Philips',
    capacity: '650 MB',
    equivalence: '≈ 450 disquetes de 3,5″',
    layout: 'right',
    lead:
      'El disco que había llevado la música al formato digital se adaptó para guardar datos. Por primera vez, una enciclopedia entera cabía en un objeto de menos de 20 gramos.',
    summary:
      'La luz reemplaza al magnetismo: un láser lee hoyos microscópicos en una espiral de kilómetros.',
    how: [
      'Los datos se estampan como hoyos (pits) y planos (lands) a lo largo de una sola espiral.',
      'Un láser infrarrojo de 780 nm recorre la espiral desde el centro hacia afuera.',
      'Los cambios de reflejo entre pit y land se convierten en unos y ceros.',
    ],
    specs: [
      { label: 'Capacidad', value: '650 MB (74 min de audio)' },
      { label: 'Diámetro', value: '120 mm, 1,2 mm de grosor' },
      { label: 'Láser', value: '780 nm, infrarrojo' },
      { label: 'Velocidad', value: '1× = 150 KB/s' },
      { label: 'Estándar', value: 'Yellow Book, Sony y Philips' },
    ],
    materials: ['Policarbonato', 'Capa reflectante de aluminio', 'Laca acrílica protectora', 'Tinta de serigrafía'],
    fact: 'Si se desenrollara su espiral de datos, mediría más de 5 kilómetros.',
  },
  {
    id: 'dvd',
    numeral: 'V',
    name: 'DVD',
    cardName: 'DVD',
    year: 1996,
    family: 'Óptico',
    maker: 'DVD Forum',
    capacity: '4,7 GB',
    equivalence: '≈ 7 CD-ROM',
    layout: 'left',
    lead:
      'Mismo tamaño que el CD, siete veces más espacio. El truco: un láser rojo más fino, pistas más juntas y la opción de apilar dos capas en una misma cara.',
    summary:
      'Mismo disco de 12 cm, láser rojo más fino y dos capas: una película completa en una sola cara.',
    how: [
      'Un láser rojo de 650 nm enfoca un punto más pequeño: los pits bajan a 0,4 µm.',
      'Las pistas se acercan a 0,74 µm de distancia (en el CD eran 1,6 µm).',
      'En los discos de doble capa, el láser cambia de foco para leer a través de una capa semitransparente.',
    ],
    specs: [
      { label: 'Capacidad', value: '4,7 GB (una capa) · 8,5 GB (dos capas)' },
      { label: 'Construcción', value: 'Dos discos de 0,6 mm pegados' },
      { label: 'Láser', value: '650 nm, rojo' },
      { label: 'Velocidad', value: '1× ≈ 1,39 MB/s' },
      { label: 'Lanzamiento', value: 'Japón, noviembre de 1996' },
      { label: 'Consorcio', value: 'Sony, Philips, Toshiba, Panasonic y otros' },
    ],
    materials: ['Dos discos de policarbonato', 'Capa reflectante de aluminio', 'Capa semirreflectante', 'Adhesivo óptico'],
    fact: 'La sigla nació como «Digital Video Disc» y se reinterpretó como «Digital Versatile Disc».',
  },
  {
    id: 'usb',
    numeral: 'VI',
    name: 'Memoria USB',
    cardName: 'Memoria USB',
    year: 2000,
    family: 'Flash',
    maker: 'M-Systems, Trek Technology, IBM',
    capacity: '8 MB',
    equivalence: '≈ 5 disquetes de 3,5″',
    layout: 'top',
    lead:
      'Sin partes móviles, sin láser, sin disco. Los datos quedan atrapados como electrones dentro de transistores de silicio, y caben en el llavero.',
    summary:
      'Electrones atrapados en silicio, sin partes móviles: el almacenamiento cabe en el llavero.',
    how: [
      'Cada celda de memoria flash es un transistor con una «puerta flotante» aislada.',
      'Al escribir, un voltaje empuja electrones hacia esa puerta, donde quedan atrapados durante años.',
      'Al leer, el controlador mide si hay carga atrapada: con carga o sin carga, 0 o 1.',
    ],
    specs: [
      { label: 'Capacidad', value: '8 MB (primeros modelos)' },
      { label: 'Interfaz', value: 'USB 1.1, 12 Mbit/s' },
      { label: 'Memoria', value: 'Flash NAND' },
      { label: 'Partes móviles', value: 'Ninguna' },
      { label: 'Primeros modelos', value: 'DiskOnKey (vendida por IBM) y ThumbDrive' },
    ],
    materials: ['Chip de silicio NAND', 'Placa de fibra de vidrio FR-4', 'Conector metálico niquelado', 'Carcasa plástica'],
    fact: 'Apple ya había quitado la disquetera del iMac en 1998; la memoria USB terminó el trabajo.',
  },
  {
    id: 'cloud',
    numeral: 'VII',
    name: 'La nube',
    cardName: 'La nube',
    year: 2006,
    family: 'Distribuido',
    maker: 'Amazon Web Services (S3)',
    capacity: 'Sin límite práctico',
    equivalence: 'Cientos de billones de objetos',
    layout: 'right',
    lead:
      'En marzo de 2006 Amazon abrió S3: almacenamiento que se alquila por gigabyte y se usa a través de internet. El disco dejó tu escritorio y ahora vive, copiado varias veces, en centros de datos repartidos por el mundo.',
    summary:
      'El disco deja el escritorio: tus archivos viven copiados en centros de datos de todo el mundo.',
    how: [
      'Tu archivo se divide en fragmentos y se cifra.',
      'Cada fragmento se replica, o se codifica con redundancia, en varios centros de datos.',
      'Si un disco, o un edificio entero, falla, los demás reconstruyen el archivo sin que lo notes.',
    ],
    specs: [
      { label: 'Lanzamiento', value: 'Amazon S3, 14 de marzo de 2006' },
      { label: 'Durabilidad de diseño', value: '99,999999999 % (11 nueves)' },
      { label: 'Acceso', value: 'API HTTP, desde cualquier lugar' },
      { label: 'Hardware', value: 'Miles de discos HDD y SSD en red' },
      { label: 'Modelo', value: 'Pago por uso' },
    ],
    materials: ['Discos HDD y SSD', 'Servidores en racks de acero', 'Fibra óptica', 'Refrigeración y energía'],
    fact: 'La nube no es etérea: es acero, silicio y electricidad. Los centros de datos usan cerca del 1,5 % de la electricidad mundial.',
  },
]

export const byId = (id: string) => STORAGE.find((s) => s.id === id)
