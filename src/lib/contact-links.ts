const salesWhatsAppNumber = "5493417417442";

export const salesEmail = "ventas@vibook.ai";
export const salesWhatsAppDisplay = "+54 9 3417 41-7442";

export function buildSalesWhatsAppUrl(message: string) {
  return `https://wa.me/${salesWhatsAppNumber}?text=${encodeURIComponent(message)}`;
}

export const salesWhatsAppGeneralUrl = buildSalesWhatsAppUrl("Hola, quiero consultar por Vibook Services y coordinar una demo.");
export const salesWhatsAppEnterpriseUrl = buildSalesWhatsAppUrl("Hola, quiero consultar por el plan Enterprise de Vibook Services.");
