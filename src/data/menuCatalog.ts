import type { MenuCategory, MenuItem, ServiceType } from '../types/pos';

export const SERVICE_TYPES: ServiceType[] = [
  'Mesa 1',
  'Mesa 2',
  'Mesa 3',
  'Mesa 4',
  'Mesa 5',
  'Mesa 6',
  'Mesa 7',
  'Mesa 8',
  'Mesa 9',
  'Mesa 10',
  'Para Llevar',
  'Servicio a Domicilio',
];

export const TABLE_OPTIONS: ServiceType[] = [
  'Mesa 1',
  'Mesa 2',
  'Mesa 3',
  'Mesa 4',
  'Mesa 5',
  'Mesa 6',
  'Mesa 7',
  'Mesa 8',
  'Mesa 9',
  'Mesa 10',
];

export const COOKING_NOTE_PRESETS = [
  'Término Medio',
  'Tres Cuartos',
  'Bien Cocido',
  'Sin Cebolla',
  'Extra Salsa',
  'Para Llevar Aparte',
];

export const MENU_CATEGORIES: MenuCategory[] = [
  { id: 'familiar', title: 'Familiar', subtitle: 'Porciones ideales para disfrutar en familia' },
  { id: 'cortes', title: 'Cortes de Carne', subtitle: 'Cortes selectos asados al término de tu elección' },
  { id: 'compartir', title: 'Para Compartir', subtitle: 'El punto medio perfecto para acompañar al centro' },
  { id: 'parrillada', title: 'Parrillada Mixta', subtitle: 'Combinación de nuestras mejores carnes sobre las brasas' },
  { id: 'individual', title: 'Individual', subtitle: 'Porciones personales recién salidas del asador' },
  { id: 'mixotes', title: 'Mixotes', subtitle: 'Tradición y sazón cocinados lentamente al vapor y brasa' },
  { id: 'extras', title: 'Extras y Entradas', subtitle: 'Complementos al grill para elevar tu experiencia' },
  { id: 'bebidas', title: 'Bebidas', subtitle: 'Aguas frescas, preparados y micheladas bien frías' },
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  // FAMILIAR
  { id: 'fam-1', categoryId: 'familiar', name: 'Pollo', price: 240, desc: 'Asado al carbón con la receta de la casa.', station: 'parrilla', available: true },
  { id: 'fam-2', categoryId: 'familiar', name: 'Costilla', note: '(según tamaño)', price: 290, desc: 'Jugosa costilla asada lentamente a las brasas.', station: 'parrilla', available: true },
  { id: 'fam-3', categoryId: 'familiar', name: 'Conejo', price: 490, desc: 'Especialidad al carbón de sabor inigualable.', station: 'parrilla', available: true },
  { id: 'fam-4', categoryId: 'familiar', name: '1 kg. Chorizo Argentino', price: 420, desc: 'Un kilo de chorizo argentino asado a la parrilla.', station: 'parrilla', available: true },
  { id: 'fam-5', categoryId: 'familiar', name: '1 kg. Arrachera', price: 430, desc: 'Un kilo de arrachera marinada y suave al carbón.', station: 'parrilla', available: true },
  { id: 'fam-6', categoryId: 'familiar', name: '1 kg. Chistorra', price: 370, desc: 'Un kilo de chistorra dorada a las brasas.', station: 'parrilla', available: true },

  // CORTES DE CARNE
  { id: 'cor-1', categoryId: 'cortes', name: 'Rib-Eye', price: 300, desc: 'Corte fino con excelente marmoleo y jugosidad.', station: 'parrilla', available: true },
  { id: 'cor-2', categoryId: 'cortes', name: 'New York', price: 300, desc: 'Corte firme y lleno de sabor a parrilla.', station: 'parrilla', available: true },
  { id: 'cor-3', categoryId: 'cortes', name: 'T-Bone', price: 300, desc: 'Lo mejor del filete y el New York en un solo corte.', station: 'parrilla', available: true },
  { id: 'cor-4', categoryId: 'cortes', name: 'Tomahawk', price: 610, badge: 'Especialidad', desc: 'Imponente corte con hueso, ideal para los amantes del fuego.', station: 'parrilla', available: true },

  // PARA COMPARTIR
  { id: 'com-1', categoryId: 'compartir', name: 'Pollo 1/2', price: 135, desc: 'Medio pollo asado a las brasas.', station: 'parrilla', available: true },
  { id: 'com-2', categoryId: 'compartir', name: 'Conejo 1/2', price: 275, desc: 'Medio conejo preparado a la parrilla.', station: 'parrilla', available: true },
  { id: 'com-3', categoryId: 'compartir', name: 'Arrachera (500grs)', price: 225, desc: 'Medio kilo de arrachera suave y jugosa.', station: 'parrilla', available: true },
  { id: 'com-4', categoryId: 'compartir', name: 'Chistorra', price: 185, desc: 'Porción de chistorra asada para compartir.', station: 'parrilla', available: true },
  { id: 'com-5', categoryId: 'compartir', name: 'Chorizo Argentino (4pz)', price: 215, desc: '4 piezas de chorizo argentino al carbón.', station: 'parrilla', available: true },
  { id: 'com-6', categoryId: 'compartir', name: 'Costilla', price: 165, desc: 'Porción de costilla a la parrilla para compartir.', station: 'parrilla', available: true },

  // PARRILLADA MIXTA
  { id: 'par-1', categoryId: 'parrillada', name: 'Parrillada Mixta Grande', price: 1650, badge: 'Banquete', desc: 'Nuestra parrillada más completa para grupos grandes.', station: 'parrilla', available: true },
  { id: 'par-2', categoryId: 'parrillada', name: 'Parrillada Mixta Mediana', price: 900, desc: 'Excelente variedad de carnes asadas para compartir.', station: 'parrilla', available: true },
  { id: 'par-3', categoryId: 'parrillada', name: 'Parrillada Mixta Chica', price: 600, desc: 'Combinación ideal para 2 o 3 personas.', station: 'parrilla', available: true },

  // INDIVIDUAL
  { id: 'ind-1', categoryId: 'individual', name: 'Pollo 1/4', price: 110, desc: 'Un cuarto de pollo asado al carbón.', station: 'parrilla', available: true },
  { id: 'ind-2', categoryId: 'individual', name: 'Arrachera (300grs)', price: 130, desc: '300 gramos de arrachera asada al momento.', station: 'parrilla', available: true },
  { id: 'ind-3', categoryId: 'individual', name: 'Chistorra Individual', price: 110, desc: 'Orden individual de chistorra a las brasas.', station: 'parrilla', available: true },
  { id: 'ind-4', categoryId: 'individual', name: 'Costilla Individual', price: 110, desc: 'Orden individual de costilla asada.', station: 'parrilla', available: true },
  { id: 'ind-5', categoryId: 'individual', name: 'Chorizo Argentino (2pz)', price: 120, desc: '2 piezas de chorizo argentino al carbón.', station: 'parrilla', available: true },

  // MIXOTES
  { id: 'mix-1', categoryId: 'mixotes', name: 'Mixote de Carnero', price: 130, desc: 'Suave carne de carnero con adobo tradicional.', station: 'cocina', available: true },
  { id: 'mix-2', categoryId: 'mixotes', name: 'Mixote de Conejo', price: 130, desc: 'Receta especial de conejo en mixote.', station: 'cocina', available: true },
  { id: 'mix-3', categoryId: 'mixotes', name: 'Mixote de Costilla', price: 110, desc: 'Costilla jugosa condimentada en hoja de mixote.', station: 'cocina', available: true },
  { id: 'mix-4', categoryId: 'mixotes', name: 'Mixote de Pollo', price: 110, desc: 'Pollo tierno con todo el sabor tradicional.', station: 'cocina', available: true },

  // EXTRAS Y ENTRADAS
  { id: 'ext-1', categoryId: 'extras', name: 'Nopales', price: 35, desc: 'Tres nopales con cebollas cambra y chiles toreados.', station: 'cocina', available: true },
  { id: 'ext-2', categoryId: 'extras', name: 'Ensalada Chica', price: 50, desc: 'Lechugas, zanahoria, betabel, jícama, cacahuate y aceite de olivo.', station: 'cocina', available: true },
  { id: 'ext-3', categoryId: 'extras', name: 'Ensalada Grande', price: 75, desc: 'Lechugas, zanahoria, betabel, jícama, cacahuate y aceite de olivo.', station: 'cocina', available: true },
  { id: 'ext-4', categoryId: 'extras', name: 'Queso Fundido Chico', price: 60, desc: 'Queso derretido a las brasas, tamaño chico.', station: 'cocina', available: true },
  { id: 'ext-5', categoryId: 'extras', name: 'Queso Fundido Grande', price: 80, desc: 'Queso derretido a las brasas, tamaño grande.', station: 'cocina', available: true },
  { id: 'ext-6', categoryId: 'extras', name: 'Aderezo', price: 25, desc: 'Mango tamarindo, BBQ y Enchilado.', station: 'cocina', available: true },
  { id: 'ext-7', categoryId: 'extras', name: 'Jalapeños Grill (3PZ)', price: 90, badge: 'Favorito', desc: 'Chile toreado, relleno de queso manchego, Filadelfia y envuelto en tocino (3 piezas).', station: 'parrilla', available: true },
  { id: 'ext-8', categoryId: 'extras', name: 'Jalapeños Grill (1PZ)', price: 35, desc: 'Chile toreado, relleno de queso manchego, Filadelfia y envuelto en tocino (1 pieza).', station: 'parrilla', available: true },
  { id: 'ext-9', categoryId: 'extras', name: 'Papas Grill', price: 90, desc: 'Rellena de tres quesos con tocino (1 pz.).', station: 'cocina', available: true },
  { id: 'ext-10', categoryId: 'extras', name: 'Papa Especial', price: 160, badge: 'Especial', desc: 'Preparada con arrachera, chistorra y chorizo argentino.', station: 'parrilla', available: true },

  // BEBIDAS
  { id: 'beb-1', categoryId: 'bebidas', name: 'Horchata con Nuez', price: 45, desc: 'Agua fresca cremosa con trozos de nuez.', station: 'barra', available: true },
  { id: 'beb-2', categoryId: 'bebidas', name: 'Tamarindo', price: 45, desc: 'Agua fresca natural de tamarindo.', station: 'barra', available: true },
  { id: 'beb-3', categoryId: 'bebidas', name: 'Jamaica', price: 45, desc: 'Agua fresca natural de flor de jamaica.', station: 'barra', available: true },
  { id: 'beb-4', categoryId: 'bebidas', name: 'Cítricos', price: 45, desc: 'Refrescante combinación de frutas cítricas.', station: 'barra', available: true },
  { id: 'beb-5', categoryId: 'bebidas', name: 'Sangría Preparada', price: 65, desc: 'Receta refrescante con toque de la casa.', station: 'barra', available: true },
  { id: 'beb-6', categoryId: 'bebidas', name: 'Tehuacán Preparado', price: 65, desc: 'Agua mineral preparada con limón y sal.', station: 'barra', available: true },
  { id: 'beb-7', categoryId: 'bebidas', name: 'Michelada Cubana', price: 110, badge: 'Especial', desc: 'Preparada con mezcla de salsas, limón y escarchado especial.', station: 'barra', available: true },
  { id: 'beb-8', categoryId: 'bebidas', name: 'Michelada Sal y Limón', price: 100, desc: 'Clásica michelada bien fría con limón y escarchado de sal.', station: 'barra', available: true },
];
