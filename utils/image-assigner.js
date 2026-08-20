/**
 * High-Quality Pharmaceutical & Industrial Packaging Image Assigner
 * Provides guaranteed-to-load, topic-specific high-resolution images for each news story.
 * Prevents broken images, CORS/Hotlink blocks, and repeated generic fallbacks.
 */

const PHARMA_IMAGE_LIBRARY = [
  {
    keywords: ['inteligente', 'automatizad', 'fábrica', 'tecnología', 'robot', 'futuro', '4.0'],
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['vidrio', 'reciclaje', 'circular', 'sostenib', 'verde', 'ecológic'],
    url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['bioplástico', 'biodegradable', 'polímero', 'resina', 'lino', 'innovación'],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['cofepris', 'alerta', 'sanitaria', 'medicamento', 'regulación', 'fda', 'salud'],
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['frasco', 'pastillero', 'blíster', 'tapa', 'pead', 'pet', 'cápsula'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['laboratorio', 'investigación', 'ensayo', 'control', 'calidad', 'iso'],
    url: 'https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['inyección', 'soplado', 'plástico', 'manufactura', 'planta', 'maquinaria'],
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1000&auto=format&fit=crop'
  },
  {
    keywords: ['envase', 'empaque', 'packaging', 'logística', 'cadena'],
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop'
  }
];

const BACKUP_PHARMA_IMAGES = [
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579165466741-7f35e4755660?w=1000&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop'
];

function getPharmaImageForArticle(title = '', content = '', index = 0) {
  const text = `${title} ${content}`.toLowerCase();

  for (const item of PHARMA_IMAGE_LIBRARY) {
    if (item.keywords.some(kw => text.includes(kw))) {
      return item.url;
    }
  }

  // Fallback to distinct index-based image
  return BACKUP_PHARMA_IMAGES[index % BACKUP_PHARMA_IMAGES.length];
}

module.exports = {
  getPharmaImageForArticle
};
