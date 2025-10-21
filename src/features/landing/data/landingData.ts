import type { PricingPlan, FAQ, CRMFeature } from '../types/landing';

export const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Para emprendedores y agencias pequeñas',
    monthlyPrice: 49,
    annualPrice: 39,
    discount: '20%',
    features: [
      '1 usuario',
      '100 conversaciones/mes',
      '50 cotizaciones IA',
      'Integración con 1 proveedor',
      'Chat web',
      'Soporte por email',
    ],
    cta: 'Empezar gratis',
    buttonVariant: 'outline',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Para agencias en crecimiento',
    monthlyPrice: 149,
    annualPrice: 119,
    discount: '20%',
    popular: true,
    features: [
      'Hasta 5 usuarios',
      'Conversaciones ilimitadas',
      '500 cotizaciones IA/mes',
      'Integración con 3 proveedores',
      'WhatsApp + Chat web',
      'CRM completo',
      'Reportes avanzados',
      'Soporte prioritario',
    ],
    cta: 'Prueba gratuita 15 días',
    buttonVariant: 'default',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Para operaciones a gran escala',
    monthlyPrice: 399,
    annualPrice: 319,
    discount: '20%',
    features: [
      'Usuarios ilimitados',
      'Todo ilimitado',
      'Cotizaciones IA ilimitadas',
      'Integraciones ilimitadas',
      'Multi-tenancy',
      'API access',
      'Onboarding dedicado',
      'Soporte 24/7',
      'SLA garantizado',
    ],
    cta: 'Contactar ventas',
    buttonVariant: 'outline',
  },
];

export const scaleFeatures: string[] = [
  'Automatización de respuestas para consultas frecuentes',
  'IA que aprende de tu forma de vender y se adapta a tu estilo',
  'Seguimiento automático de todas las cotizaciones sin perder ningún detalle',
  'Integración directa con tus proveedores mayoristas favoritos',
  'Dashboard en tiempo real con métricas de conversión y rendimiento',
  'Gestión de múltiples agencias desde una sola plataforma',
];

export const crmFeatures: CRMFeature[] = [
  {
    icon: 'Users',
    title: 'Gestión de clientes',
    description: 'Todos tus contactos y su historial en un solo lugar, sin buscar en chats viejos.',
  },
  {
    icon: 'BarChart3',
    title: 'Métricas en vivo',
    description: 'Sabé en todo momento cuánto vendiste, cuánto cotizaste y dónde están las oportunidades.',
  },
  {
    icon: 'Clock',
    title: 'Recordatorios automáticos',
    description: 'La IA te avisa cuándo hacer seguimiento para no dejar pasar ninguna venta.',
  },
  {
    icon: 'Zap',
    title: 'Todo sincronizado',
    description: 'Desde la primera consulta hasta el cierre, todo queda registrado sin esfuerzo manual.',
  },
];

export const featureBadges: string[] = [
  '✈️ Búsqueda de vuelos en segundos',
  '🏨 Comparación automática de hoteles',
  '💰 Cálculo de precios al instante',
  '📄 Generación de PDFs profesionales',
  '📱 Integración con WhatsApp Business',
  '🤖 IA entrenada para turismo',
  '🔄 Sincronización en tiempo real',
  '📊 Dashboard con analytics',
  '👥 Gestión de equipos',
  '🔐 Seguridad bancaria',
];

export const faqs: FAQ[] = [
  {
    question: '¿Cómo funciona el período de prueba?',
    answer:
      'Tenés 15 días gratis para probar todas las funciones del plan Professional sin límites. No pedimos tarjeta de crédito para empezar. Al finalizar, podés elegir continuar con el plan que mejor se adapte a tu agencia.',
  },
  {
    question: '¿Puedo cambiar de plan en cualquier momento?',
    answer:
      'Sí, podés actualizar o bajar de plan cuando quieras. Si pasás a un plan superior, el cambio es inmediato. Si bajás de plan, se aplicará al final de tu período de facturación actual.',
  },
  {
    question: '¿Qué proveedores mayoristas puedo integrar?',
    answer:
      'Actualmente tenemos integración con EUROVIPS, LOZADA, DELFOS, ICARO y STARLING. Estamos constantemente agregando nuevos proveedores. Si trabajás con alguno específico, contactanos y evaluamos agregarlo.',
  },
  {
    question: '¿Necesito conocimientos técnicos para usar ViBook?',
    answer:
      'No, ViBook está diseñado para ser intuitivo y fácil de usar. La interfaz es similar a WhatsApp y otras herramientas que ya conocés. Además, ofrecemos onboarding personalizado y soporte para que arranques rápido.',
  },
  {
    question: '¿Cómo se conecta con WhatsApp Business?',
    answer:
      'ViBook se integra con la API oficial de WhatsApp Business. Te ayudamos con todo el proceso de configuración. Una vez conectado, todas las conversaciones se centralizan en ViBook y podés responder desde la plataforma.',
  },
  {
    question: '¿Los datos de mis clientes están seguros?',
    answer:
      'Absolutamente. Usamos encriptación de grado bancario, cumplimos con GDPR y alojamos los datos en servidores certificados. Nunca compartimos ni vendemos información de tus clientes.',
  },
  {
    question: '¿Qué soporte técnico ofrecen?',
    answer:
      'Todos los planes incluyen soporte por email. El plan Professional tiene soporte prioritario con respuesta en menos de 4 horas. El plan Enterprise incluye soporte 24/7 por WhatsApp, email y videollamada.',
  },
  {
    question: '¿Puedo usar ViBook con mi equipo?',
    answer:
      'Sí, ViBook está diseñado para equipos. Podés asignar conversaciones a diferentes vendedores, ver métricas individuales y colaborar en tiempo real. Cada plan incluye diferente cantidad de usuarios.',
  },
];
